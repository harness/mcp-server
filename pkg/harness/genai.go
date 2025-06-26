package harness

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
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Extract required parameters
			prompt, err := requiredParam[string](request, "prompt")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			action, err := requiredParam[string](request, "action")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Extract optional parameters
			conversationID, _ := OptionalParam[string](request, "conversation_id")
			interactionID, _ := OptionalParam[string](request, "interaction_id")
			contextRaw, _ := OptionalParam[[]any](request, "context")
			conversationRaw, _ := OptionalParam[[]any](request, "conversation_raw")

			// Convert context items
			var contextItems []dto.ContextItem
			for _, ctxRaw := range contextRaw {
				if ctxMap, ok := ctxRaw.(map[string]interface{}); ok {
					ctxType, _ := ctxMap["type"].(string)
					ctxPayload := ctxMap["payload"]
					contextItems = append(contextItems, dto.ContextItem{
						Type:    ctxType,
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
				Stream:          false,
			}

			// Send the request to the genai service
			response, err := client.SendAIDevOpsChat(ctx, scope, genaiRequest)
			if err != nil {
				return nil, fmt.Errorf("failed to send request to genai service: %w", err)
			}

			// Check for errors in response
			if response.Error != "" {
				return mcp.NewToolResultError(response.Error), nil
			}

			// Format capabilities if present
			var capabilitiesText string
			if len(response.CapabilitiesToRun) > 0 {
				capabilitiesText = "\n\nCapabilities to run:\n"
				for _, cap := range response.CapabilitiesToRun {
					capabilitiesText += fmt.Sprintf("\n- Type: %s\n  CallID: %s", cap.Type, cap.CallID)

					// Include input details if available
					if len(cap.Input) > 0 {
						capabilitiesText += "\n  Input:"
						for k, v := range cap.Input {
							capabilitiesText += fmt.Sprintf("\n    %s: %v", k, v)
						}
					}
					capabilitiesText += "\n"
				}
			}

			// Combine any response text with capabilities and usage info
			resultText := ""
			if response.Response != "" {
				resultText = response.Response
			} else if response.ConversationRaw != "" {
				resultText = response.ConversationRaw
			}

			// Create the full result text
			fullResult := fmt.Sprintf("%s%s", resultText, capabilitiesText)

			return mcp.NewToolResultText(fullResult), nil
		}
}
