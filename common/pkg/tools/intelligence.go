package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"

	"github.com/google/uuid"
	commonConfig "github.com/harness/mcp-server/common"
	commonClient "github.com/harness/mcp-server/common/client"
	"github.com/harness/mcp-server/common/client/dto"
	commonScopeUtils "github.com/harness/mcp-server/common/pkg/common"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// AIDevOpsAgentTool creates the ask_ai_devops_agent tool
func AIDevOpsAgentTool(config *commonConfig.McpServerConfig, client *commonClient.IntelligenceService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("ask_ai_devops_agent",
		mcp.WithDescription("Ask the AI DevOps Agent to create or update Harness entities such as "+
			"pipelines, environments, connectors, services, and secrets. "+
			"Returns the generated or updated YAML along with a conversational response. "+
			"For stage-level changes, use CREATE_PIPELINE or UPDATE_PIPELINE actions."),
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
			mcp.WithArray("context",
				mcp.Description("Optional context for the request (for UPDATE operations, contains existing YAML)"),
				mcp.Items(map[string]any{
					"type": "object",
					"properties": map[string]any{
						"type": map[string]any{
							"type":        "string",
							"description": "The type of context item",
						},
						"payload": map[string]any{
							"description": "The payload for this context item (for UPDATE: contains the existing YAML string)",
						},
					},
					"required": []string{"type", "payload"},
				}),
			),
			commonScopeUtils.WithScope(config, false),
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

			contextRaw, err := OptionalParam[[]any](request, "context")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Try to fetch scope parameters (account_id, org_id, project_id) if provided
			scope, err := commonScopeUtils.FetchScope(ctx, config, request, false)
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

			// Generate conversation ID if not provided
			if conversationID == "" {
				conversationID = uuid.New().String()
			}

			// Create AI DevOps request
			aiRequest := &dto.ServiceChatRequest{
				HarnessContext: &dto.HarnessContext{
					AccountID: scope.AccountID,
					OrgID:     scope.OrgID,
					ProjectID: scope.ProjectID,
				},
				Prompt:         prompt,
				Action:         dto.RequestAction(strings.ToUpper(action)),
				ConversationID: conversationID,
				Context:        contextItems,
				Stream:         stream,
			}

			var progressToken mcp.ProgressToken
			if request.Params.Meta != nil {
				progressToken = request.Params.Meta.ProgressToken
			}

			mcpServer := server.ServerFromContext(ctx)
			shouldStream := stream && mcpServer != nil

			slog.InfoContext(ctx, "Intelligence service request", "shouldStream", shouldStream, "action", action)

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

				// Call the AI DevOps service with streaming
				response, err := client.SendAIDevOpsChat(ctx, scope, aiRequest, onProgress)
				if err != nil {
					return nil, fmt.Errorf("failed to send streaming request to AI DevOps service: %w", err)
				}

				if response == nil {
					err := fmt.Errorf("got nil response from AI DevOps service")
					return nil, err
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
				err := fmt.Errorf("got nil response from AI DevOps service")
				return nil, err
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
}
