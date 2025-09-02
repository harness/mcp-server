package tools

import (
	"context"
	"encoding/json"
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

// FindSimilarTemplates creates a tool that allows finding similar templates based on provided description.
func FindSimilarTemplates(config *config.Config, client *client.IntelligenceService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("intelligent_template_search",
			mcp.WithDescription("The tool is used to find most relevant entity template for any entity everytime a template is explicitly requested for any of pipeline/stage/step" + 
				"Finds the most relevant templates based on a natural language description. "+
				"Searches across template identifiers, names, types, capabilities, and use cases to find the best matches. "+
				"Returns templates ranked by similarity score with metadata including template IDs and organizational context. "+
				"Ideal for discovering templates that fulfill specific requirements without knowing exact identifiers."),
			mcp.WithString("description",
				mcp.Required(),
				mcp.Description("Description of the template to find similar templates"),
			),
			mcp.WithString("template_type",
				mcp.Description("Type of templates to find similar templates (e.g., Step, Stage, Pipeline)"),
			),
			mcp.WithNumber("count",
				mcp.Description("Maximum number of similar templates to return"),
				mcp.DefaultNumber(1),
			),
			common.WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Get required description parameter
			description, err := RequiredParam[string](request, "description")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Fetch optional parameters
			templateType, err := OptionalParam[string](request, "template_type")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Handle count parameter as float64 (JSON default) and convert to int
			countFloat, err := OptionalParam[float64](request, "count")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			count := int(countFloat)

			// Try to fetch scope parameters (account_id, org_id, project_id) if provided
			scope, err := common.FetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Create similarity search request
			similarityRequest := &dto.SimilaritySearchRequest{
				AccountID:    scope.AccountID,
				OrgID:        scope.OrgID,
				ProjectID:    scope.ProjectID,
				Description:  description,
				Count:        count,
				TemplateType: templateType,
			}

			// Call the similarity search API
			result, err := client.SimilaritySearch(ctx, similarityRequest)
			if err != nil {
				return nil, fmt.Errorf("failed to perform similarity search: %w", err)
			}

			// Marshal and return the result
			r, err := json.Marshal(result)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal similarity search response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func AIDevOpsAgentTool(config *config.Config, client *client.IntelligenceService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("ask_ai_devops_agent",
			mcp.WithDescription("The AI Devops Agent is an expert in planning and executing requests related to generation/updation of Harness entities like pipeline, stage, step, environment, connector, service, secret."),
			mcp.WithString("prompt",
				mcp.Required(),
				mcp.Description("The prompt to send to the AI DevOps agent"),
			),
			mcp.WithString("action",
				mcp.Enum(dto.ActionTypeValues()...),
				mcp.Description("The action for the AI DevOps agent to perform"),
				mcp.Required(),
			),
			mcp.WithBoolean("stream",
				mcp.Description("Whether to stream the response or not (default: true)"),
				mcp.DefaultBool(true),
			),
			mcp.WithString("conversation_id",
				mcp.Description("Optional conversation ID to maintain conversation context (if not provided, a new ID will be generated)"),
			),
			mcp.WithString("interaction_id",
				mcp.Description("Optional interaction ID for tracking purposes (if not provided, a new ID will be generated)"),
			),
			mcp.WithArray("context",
				mcp.Description("Optional context for the request"),
				mcp.Items(map[string]any{
					"type": "object",
					"properties": map[string]any{
						"type": map[string]any{
							"type":        "string",
							"description": "The type of context item",
						},
						"payload": map[string]any{
							"description": "The payload for this context item",
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
			common.WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Get required parameters
			prompt, err := RequiredParam[string](request, "prompt")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			action, err := RequiredParam[string](request, "action")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Fetch optional parameters with proper default handling
			stream := true // Default to true
			if streamParam, exists := request.GetArguments()["stream"]; exists {
				if streamBool, ok := streamParam.(bool); ok {
					stream = streamBool
				}
			}

			conversationID, err := OptionalParam[string](request, "conversation_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			interactionID, err := OptionalParam[string](request, "interaction_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			contextRaw, err := OptionalParam[[]any](request, "context")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			conversationRaw, err := OptionalParam[[]any](request, "conversation_raw")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Try to fetch scope parameters (account_id, org_id, project_id) if provided
			scope, err := common.FetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Process context items
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

			// Generate IDs if not provided
			if conversationID == "" {
				conversationID = uuid.New().String()
			}
			if interactionID == "" {
				interactionID = uuid.New().String()
			}

			// Create harness context from scope
			harnessContext := &dto.HarnessContext{
				AccountID: scope.AccountID,
				OrgID:     scope.OrgID,
				ProjectID: scope.ProjectID,
			}

			// Create AI DevOps request
			aiRequest := &dto.ServiceChatParameters{
				BaseRequestParameters: dto.BaseRequestParameters{
					Prompt:          prompt,
					ConversationID:  conversationID,
					InteractionID:   interactionID,
					ConversationRaw: conversationRaw,
					Context:         contextItems,
					HarnessContext:  harnessContext,
					Stream:          stream,
				},
				Action: dto.RequestAction(strings.ToUpper(action)),
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

			// Determine if we can actually stream (need progress token and server context)
			shouldStream := stream && progressToken != nil
			mcpServer := server.ServerFromContext(ctx)
			shouldStream = shouldStream && mcpServer != nil

			slog.Info("Streaming request", "shouldStream", shouldStream)

			if shouldStream {
				// Generate progress token if none provided
				if progressToken == nil {
					tokenID := uuid.New().String()
					progressToken = mcp.ProgressToken(tokenID)
				}

				onProgress := func(progress dto.ProgressUpdate) error {
					if ctx == nil || ctx.Err() != nil {
						return nil
					}

					return mcpServer.SendNotificationToClient(
						ctx,
						"notifications/progress",
						map[string]any{
							"progress":      progress.Progress,
							"progressToken": progressToken,
							"total":         progress.Total,
							"message":       progress.Message,
						},
					)
				}

				// Call the AI DevOps service with streaming
				response, err := client.SendAIDevOpsChat(ctx, scope, aiRequest, onProgress)
				if err != nil {
					return nil, fmt.Errorf("failed to send streaming request to AI DevOps service: %w", err)
				}

				if response == nil {
					return nil, fmt.Errorf("got nil response from AI DevOps service")
				}

				if response.Error != "" {
					return mcp.NewToolResultError(response.Error), nil
				}

				rawResponse, err := json.Marshal(response)
				if err != nil {
					return nil, fmt.Errorf("failed to marshal response: %w", err)
				}

				return mcp.NewToolResultText(string(rawResponse)), nil
			}

			// Call the AI DevOps service without streaming
			response, err := client.SendAIDevOpsChat(ctx, scope, aiRequest, nil)
			if err != nil {
				return nil, fmt.Errorf("failed to send request to AI DevOps service: %w", err)
			}

			if response == nil {
				return nil, fmt.Errorf("got nil response from AI DevOps service")
			}

			if response.Error != "" {
				return mcp.NewToolResultError(response.Error), nil
			}
			slog.Info("Non-streaming request completed", "response", response)

			rawResponse, err := json.Marshal(response)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal response: %w", err)
			}

			return mcp.NewToolResultText(string(rawResponse)), nil
		}
}
