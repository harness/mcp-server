package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/auth"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// AppSecTool creates a tool for querying the AppSec llmChat API
func AppSecTool(config *config.Config, client *client.AppSecService) server.Tool {
	return server.NewTool(
		"appsec_tool",
		"Query the Harness Application Security AI assistant using natural language",
		mcp.NewToolInputSchema(map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"query": map[string]interface{}{
					"type":        "string",
					"description": "Natural language query to send to the AppSec AI assistant",
				},
			},
			"required": []string{"query"},
		}),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Extract query parameter
			var params struct {
				Query string `json:"query"`
			}

			if err := json.Unmarshal(request.Params.Arguments, &params); err != nil {
				return mcp.NewToolResult(
					mcp.NewTextContent(fmt.Sprintf("Error parsing parameters: %v", err)),
				), nil
			}

			// Validate required parameters
			if params.Query == "" {
				return mcp.NewToolResult(
					mcp.NewTextContent("Error: query parameter is required"),
				), nil
			}

			// Get authentication session from context
			session, ok := auth.AuthSessionFrom(ctx)
			if !ok {
				return mcp.NewToolResult(
					mcp.NewTextContent("Error: authentication session not found"),
				), nil
			}

			// Execute the AppSec llmChat query
			responseItems, err := client.LLMChatQuery(ctx, params.Query)
			if err != nil {
				return mcp.NewToolResult(
					mcp.NewTextContent(fmt.Sprintf("Error querying AppSec API: %v", err)),
				), nil
			}

			// Parse the response data
			var result string
			if len(responseItems) > 0 {
				result = "AppSec AI Response:\n\n"

				// Process each response item in the array
				for i, item := range responseItems {
					if i > 0 {
						result += "\n---\n"
					}

					// Combine all agent responses from this item
					if len(item.Data.LLMChat.Results) > 0 {
						for j, res := range item.Data.LLMChat.Results {
							if j > 0 {
								result += "\n"
							}
							result += res.AgentResponse
						}
					} else {
						result += "No results in this response item"
					}
				}
			} else {
				result = "No data received from AppSec API"
			}

			// Add context information
			contextInfo := fmt.Sprintf("\n\n---\nQuery executed for Account: %s\nOrigin: mcp-server",
				session.Principal.AccountID)

			return mcp.NewToolResult(
				mcp.NewTextContent(result + contextInfo),
			), nil
		},
	)
}
