package tools

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"github.com/google/uuid"
	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/common"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// getCommonGenAIParameters returns common MCP parameters used by GenAI tools
func getCommonGenAIParameters() []mcp.ToolOption {
	return []mcp.ToolOption{
		mcp.WithString("prompt",
			mcp.Required(),
			mcp.Description("The prompt to send to the genai service"),
		),
		mcp.WithBoolean("stream",
			mcp.Description("Whether to stream the response or not"),
			mcp.DefaultBool(true),
		),
		mcp.WithString("conversation_id",
			mcp.Description("Optional conversation ID to maintain conversation context (if not provided, a new ID will be generated)"),
		),
		mcp.WithString("interaction_id",
			mcp.Description("Optional interaction ID for tracking purposes (if not provided, a new ID will be generated)"),
		),
		mcp.WithArray("context",
			mcp.Description("Optional context information for the request"),
			mcp.Items(map[string]any{
				"type": "object",
				"properties": map[string]any{
					"type": map[string]any{
						"type":        "string",
						"description": "The type of context item (other)",
						"enum":        []string{string(dto.ContextTypeOther)},
					},
					"payload": map[string]any{
						"type":        []string{"object", "array", "string", "number", "boolean"},
						"description": "The payload for this context item, accepts any valid JSON value. Example: {\"stage_type\": \"Custom\"}",
						"items":       map[string]any{},
					},
				},
				"required": []string{"type", "payload"},
			}),
		),
		mcp.WithArray("conversation_raw",
			mcp.Description("Optional conversation history for context"),
			mcp.Items(map[string]any{
				"type": "object",
				"properties": map[string]any{
					"role": map[string]any{
						"type":        "string",
						"description": "The role of the message sender (e.g., 'user', 'assistant')",
					},
					"content": map[string]any{
						"type":        "string",
						"description": "The content of the conversation message",
					},
				},
				"required": []string{"role", "content"},
			}),
		),
	}
}

// createGenAIToolHandler creates a common handler for GenAI tools
func createGenAIToolHandler(config *config.Config, client *client.GenaiService, processRequest func(baseParams *dto.BaseRequestParameters, request mcp.CallToolRequest) (interface{}, error)) server.ToolHandlerFunc {
	return func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		// Extract required parameters
		prompt, err := RequiredParam[string](request, "prompt")
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		scope, err := common.FetchScope(ctx, config, request, false)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		// Extract optional parameters
		conversationID, _ := OptionalParam[string](request, "conversation_id")
		interactionID, _ := OptionalParam[string](request, "interaction_id")
		contextRaw, _ := OptionalParam[[]any](request, "context")
		conversationRaw, _ := OptionalParam[[]any](request, "conversation_raw")
		harnessContextRaw, _ := OptionalParam[map[string]interface{}](request, "harness_context")
		stream := true // default value
		if streamArg, ok := request.GetArguments()["stream"].(bool); ok {
			stream = streamArg
		}

		// Safely access progress token with nil check
		var progressToken mcp.ProgressToken
		if request.Params.Meta != nil {
			progressToken = request.Params.Meta.ProgressToken
		}

		// Generate a default progress token if none is provided
		if progressToken == nil {
			tokenID := uuid.New().String()
			progressToken = mcp.ProgressToken(tokenID)
		}

		var contextItems []dto.ContextItem
		for _, ctxRaw := range contextRaw {
			if ctxMap, ok := ctxRaw.(map[string]interface{}); ok {
				ctxType, _ := ctxMap["type"].(string)
				ctxPayload := ctxMap["payload"]
				contextItems = append(contextItems, dto.ContextItem{
					Type:    dto.ContextType(ctxType),
					Payload: ctxPayload,
				})
			}
		}

		// Create harness context from scope
		harnessContext := &dto.HarnessContext{
			AccountID: scope.AccountID,
			OrgID:     scope.OrgID,
			ProjectID: scope.ProjectID,
		}

		// Override with values from request if provided
		if harnessContextRaw != nil {
			if accountID, ok := harnessContextRaw["account_id"].(string); ok && accountID != "" {
				harnessContext.AccountID = accountID
			}
			if orgID, ok := harnessContextRaw["org_id"].(string); ok && orgID != "" {
				harnessContext.OrgID = orgID
			}
			if projectID, ok := harnessContextRaw["project_id"].(string); ok && projectID != "" {
				harnessContext.ProjectID = projectID
			}
		}
		// Generate or use provided IDs
		var finalConversationID, finalInteractionID string

		if conversationID != "" {
			finalConversationID = conversationID
		} else {
			finalConversationID = uuid.New().String()
		}

		if interactionID != "" {
			finalInteractionID = interactionID
		} else {
			finalInteractionID = uuid.New().String()
		}

		// Create base request parameters
		baseParams := &dto.BaseRequestParameters{
			Prompt:          prompt,
			ConversationID:  finalConversationID,
			InteractionID:   finalInteractionID,
			ConversationRaw: conversationRaw,
			Context:         contextItems,
			HarnessContext:  harnessContext,
			Stream:          stream,
			Caller:          dto.CallerUnifiedAgent,
		}

		// Process the request using the provided function
		requestObj, err := processRequest(baseParams, request)
		if err != nil {
			return nil, err
		}

		shouldStream := stream && progressToken != nil
		mcpServer := server.ServerFromContext(ctx)
		shouldStream = shouldStream && mcpServer != nil

		if client == nil {
			return nil, fmt.Errorf("genai client is nil")
		}

		// Set up progress callback
		var onProgress func(progress dto.ProgressUpdate) error
		if shouldStream {
			onProgress = func(progress dto.ProgressUpdate) error {
				if ctx == nil || ctx.Err() != nil {
					if ctx != nil {
						slog.WarnContext(ctx, "Context has an error", "error", ctx.Err())
					} else {
						slog.Warn("Context is nil")
					}
					return nil
				}
				if _, isDBChangeset := requestObj.(*dto.DBChangesetParameters); isDBChangeset {
					slog.InfoContext(ctx, "Sending progress notification", "payload", progress.Message)
				}

				err := mcpServer.SendNotificationToClient(
					ctx,
					"notifications/progress",
					map[string]any{
						"progress":      progress.Progress,
						"progressToken": progressToken,
						"total":         progress.Total,
						"message":       progress.Message,
					},
				)
				if err != nil {
					slog.ErrorContext(ctx, "Failed to send progress notification", "error", err)
				}
				return err
			}
		}

		var response *dto.ServiceChatResponse
		var respErr error

		// Call the appropriate client method based on the request type
		switch req := requestObj.(type) {
		case *dto.ServiceChatParameters:
			req.Stream = shouldStream
			response, respErr = client.SendAIDevOpsChat(ctx, scope, req, onProgress)
		case *dto.DBChangesetParameters:
			slog.DebugContext(ctx, "Processing DBChangesetParameters request", "shouldStream", shouldStream, "progressTokenSet", progressToken != nil)
			req.Stream = shouldStream
			response, respErr = client.SendDBChangeset(ctx, scope, req, onProgress)
		case *dto.IDPWorkflowParameters:
			req.Stream = shouldStream
			response, respErr = client.SendIDPWorkflow(ctx, scope, req, onProgress)
		default:
			return nil, fmt.Errorf("unsupported request type: %T", requestObj)
		}

		if respErr != nil {
			return nil, fmt.Errorf("failed to send request to genai service: %w", respErr)
		}

		if response == nil {
			return nil, fmt.Errorf("got nil response from genai service")
		}

		if response.Error != "" {
			return mcp.NewToolResultError(response.Error), nil
		}

		return mcp.NewToolResultText(response.Response), nil
	}
}

// DBChangesetTool creates a tool for generating database changesets
func DBChangesetTool(config *config.Config, client *client.GenaiService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	// Get common parameters
	commonParams := getCommonGenAIParameters()

	// Add tool-specific parameters
	toolParams := append(commonParams,
		mcp.WithString("database_type",
			mcp.Required(),
			mcp.Description(`The type of database (MYSQL, POSTGRESQL, ORACLE, MSSQL, etc.).
				How to obtain Database Type:
				- Use the get_database_schema_info tool to retrieve the database type for a specific database schema.
				`),
		),
		mcp.WithString("old_changeset",
			mcp.Description("Optional existing changeset YAML for updates"),
		),
		mcp.WithString("error_context",
			mcp.Description("Optional error context if this is a retry after an error for a given changeset"),
		),
		common.WithScope(config, false),
	)

	tool = mcp.NewTool("generate_db_changeset",
		append([]mcp.ToolOption{mcp.WithDescription(`
			Generate database changesets based on the provided prompt and database type.
				
			Usage Guidance:
			- Use this tool to generate changesets for a specific database schema in your database devops setup.
			- You must provide the database type to generate changesets for that database schema.
			`)},
			toolParams...)...,
	)

	handler = createGenAIToolHandler(config, client, func(baseParams *dto.BaseRequestParameters, request mcp.CallToolRequest) (interface{}, error) {
		// Get database-specific parameters from the current request context
		databaseTypeArg, ok := request.GetArguments()["database_type"]
		if !ok || databaseTypeArg == nil {
			return nil, fmt.Errorf("missing required parameter: database_type")
		}

		databaseType, ok := databaseTypeArg.(string)
		if !ok {
			return nil, fmt.Errorf("database_type must be a string")
		}

		oldChangesetArg, ok := request.GetArguments()["old_changeset"]
		var oldChangeset string
		if ok && oldChangesetArg != nil {
			if oc, isString := oldChangesetArg.(string); isString {
				oldChangeset = oc
			}
		}

		errorContextArg, ok := request.GetArguments()["error_context"]
		var errorContext string
		if ok && errorContextArg != nil {
			if ec, isString := errorContextArg.(string); isString {
				errorContext = ec
			}
		}

		// Create the DB changeset parameters
		return &dto.DBChangesetParameters{
			BaseRequestParameters: *baseParams,
			DatabaseType:          dto.DatabaseType(strings.ToUpper(databaseType)),
			OldChangeset:          oldChangeset,
			ErrorContext:          errorContext,
		}, nil
	})
	return tool, handler
}

// GenerateWorflowTool creates a tool for generating idp workflows
func GenerateWorflowTool(config *config.Config, client *client.GenaiService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	// Get common parameters
	commonParams := getCommonGenAIParameters()

	// Add tool-specific parameters
	toolParams := append(commonParams,
		mcp.WithString("pipeline_info",
			mcp.Required(),
			mcp.Description("The YAML of the pipeline which is to be used for generating the workflow. Use the get_pipeline tool to retrieve the pipeline YAML."),
		),
		mcp.WithString("old_workflow",
			mcp.Description("Optional existing workflow YAML for updates"),
		),
		mcp.WithString("error_context",
			mcp.Description("Optional error context if this is a retry after an error for a given workflow"),
		),
		common.WithScope(config, false),
	)

	tool = mcp.NewTool("generate_idp_workflow",
		append([]mcp.ToolOption{mcp.WithDescription(`
			Generates the YAML for an IDP Workflow.
			Usage Guidance:
			- Use this tool to generate a workflow YAML using a given pipeline.
			- You must provide the pipline YAML to generate the workflow YAML.
			`)},
			toolParams...)...,
	)

	handler = createGenAIToolHandler(config, client, func(baseParams *dto.BaseRequestParameters, request mcp.CallToolRequest) (interface{}, error) {

		pipelineInfoArg, ok := request.GetArguments()["pipeline_info"]
		if !ok || pipelineInfoArg == nil {
			return nil, fmt.Errorf("missing required parameter: pipeline_info")
		}

		pipelineInfo, ok := pipelineInfoArg.(string)
		if !ok {
			return nil, fmt.Errorf("pipeline_info must be a string")
		}

		oldWorkflowArg, ok := request.GetArguments()["old_workflow"]
		var oldWorkflow string
		if ok && oldWorkflowArg != nil {
			if oc, isString := oldWorkflowArg.(string); isString {
				oldWorkflow = oc
			}
		}

		errorContextArg, ok := request.GetArguments()["error_context"]
		var errorContext string
		if ok && errorContextArg != nil {
			if ec, isString := errorContextArg.(string); isString {
				errorContext = ec
			}
		}

		// Create the IDP Workflow parameters
		return &dto.IDPWorkflowParameters{
			BaseRequestParameters: *baseParams,
			PipelineInfo:          pipelineInfo,
			OldWorkflow:           oldWorkflow,
			ErrorContext:          errorContext,
		}, nil
	})
	return tool, handler
}
