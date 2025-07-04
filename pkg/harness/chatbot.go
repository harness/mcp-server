package harness

import (
	"context"
	"fmt"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

func AskChatbotTool(config *config.Config, client *client.ChatbotService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("ask_chatbot",
			mcp.WithDescription("Ask a question about Harness products and documentation to the Harness Documentation Bot. The bot uses AI to retrieve and summarize relevant information from Harness documentation."),
			mcp.WithString("question",
				mcp.Required(),
				mcp.Description("The question to ask the chatbot"),
			),
			mcp.WithArray("chat_history",
				mcp.Description("Optional chat history for context"),
				mcp.Items(map[string]any{
					"type": "object",
					"properties": map[string]any{
						"question": map[string]any{
							"type":        "string",
							"description": "The question in the chat history",
						},
						"answer": map[string]any{
							"type":        "string",
							"description": "The answer in the chat history",
						},
					},
					"required": []string{"question", "answer"},
				}),
			),
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			question, err := requiredParam[string](request, "question")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			var chatHistory []dto.ChatHistoryItem
			chatHistoryRaw, err := OptionalParam[[]interface{}](request, "chat_history")
			if err == nil && len(chatHistoryRaw) > 0 {
				for _, historyItem := range chatHistoryRaw {
					if historyItemMap, ok := historyItem.(map[string]interface{}); ok {
						questionStr, _ := historyItemMap["question"].(string)
						answerStr, _ := historyItemMap["answer"].(string)
						chatHistory = append(chatHistory, dto.ChatHistoryItem{
							Question: questionStr,
							Answer:   answerStr,
						})
					}
				}
			}

			chatRequest := &dto.ChatRequest{
				Question:    question,
				ChatHistory: chatHistory,
			}

			response, err := client.SendChatMessage(ctx, scope, chatRequest)
			if err != nil {
				return nil, fmt.Errorf("failed to send message to chatbot: %w", err)
			}

			return mcp.NewToolResultText(response), nil
		}
}
