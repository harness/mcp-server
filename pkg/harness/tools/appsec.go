package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/auth"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// AppSecTool creates a tool for querying the AppSec llmChat API
func AppSecTool(config *config.Config, client *client.AppSecService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("appsec_tool",
			mcp.WithDescription("Query the Harness Application Security AI assistant using natural language"),
			mcp.WithString("query",
				mcp.Required(),
				mcp.Description("Natural language query to send to the AppSec AI assistant"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Extract query parameter
			query, err := RequiredParam[string](request, "query")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Get authentication session from context
			session, ok := auth.AuthSessionFrom(ctx)
			if !ok {
				return mcp.NewToolResultError("Error: authentication session not found"), nil
			}

			// Execute the AppSec llmChat query
			responseItems, err := client.LLMChatQuery(ctx, query)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("Error querying AppSec API: %v", err)), nil
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

			return mcp.NewToolResultText(result + contextInfo), nil
		}
}
