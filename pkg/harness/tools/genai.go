package tools

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

func AIDevOpsAgentTool(config *config.Config, client *client.GenaiService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("ask_ai_devops_agent",
			mcp.WithDescription("Send a request to the Harness AI Devops agent to generate harness entities based on the provided action type and prompt."),
			mcp.WithString("prompt",
				mcp.Required(),
				mcp.Description("The prompt to send to the genai service"),
			),
			mcp.WithBoolean("stream", mcp.Description("Whether to stream the response or not"), mcp.DefaultBool(true)),
			mcp.WithString("action",
				mcp.Required(),
				mcp.Description("The action type to perform (CREATE_STEP, UPDATE_STEP, CREATE_STAGE, etc.)"),
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
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Extract required parameters
			prompt, err := RequiredParam[string](request, "prompt")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			action, err := RequiredParam[string](request, "action")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := FetchScope(config, request, false)
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
			if streamArg, ok := request.Params.Arguments["stream"].(bool); ok {
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

			// Create genai request
			genaiRequest := &dto.ServiceChatParameters{
				Prompt:          prompt,
				ConversationID:  finalConversationID,
				InteractionID:   finalInteractionID,
				ConversationRaw: conversationRaw,
				Context:         contextItems,
				Action:          dto.RequestAction(strings.ToUpper(action)),
				HarnessContext:  harnessContext,
				Stream:          stream,
			}

			shouldStream := stream && progressToken != nil
			mcpServer := server.ServerFromContext(ctx)
			shouldStream = shouldStream && mcpServer != nil

			if client == nil {
				return nil, fmt.Errorf("genai client is nil")
			}

			genaiRequest.Stream = shouldStream

			if shouldStream {
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

				response, err := client.SendAIDevOpsChat(ctx, scope, genaiRequest, onProgress)
				if err != nil {
					return nil, fmt.Errorf("streaming request failed: %w", err)
				}

				if response == nil {
					return nil, fmt.Errorf("got nil response from streaming request")
				}

				if response.Error != "" {
					return mcp.NewToolResultError(response.Error), nil
				}

				return mcp.NewToolResultText(response.Response), nil
			} else {
				response, err := client.SendAIDevOpsChat(ctx, scope, genaiRequest)
				if err != nil {
					return nil, fmt.Errorf("failed to send request to genai service: %w", err)
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
}
