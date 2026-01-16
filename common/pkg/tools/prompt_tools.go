package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	config "github.com/harness/mcp-server/common"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	"log/slog"
)

// ListPromptsTool creates a tool for listing prompts from the MCP server
func ListPromptsTool(config *config.McpServerConfig) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_prompts",
			mcp.WithDescription("Lists available prompts from the MCP server"),
			mcp.WithString("prefix",
				mcp.Description("Optional prefix to filter prompts by name"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Get MCP server from context
			mcpServer := server.ServerFromContext(ctx)
			if mcpServer == nil {
				return nil, fmt.Errorf("MCP server not found in context")
			}

			// Extract prefix parameter if present
			prefix, err := OptionalParam[string](request, "prefix")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Create a list prompts request
			listRequest := map[string]interface{}{
				"jsonrpc": "2.0",
				"id":      "internal-tool-call",
				"method":  "prompts/list",
				"params": map[string]interface{}{
					"cursor": "",
				},
			}

			// Convert request to JSON
			listRequestBytes, err := json.Marshal(listRequest)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal list request: %w", err)
			}

			// Send request through HandleMessage
			listResponse := mcpServer.HandleMessage(ctx, listRequestBytes)

			// Check for error response
			if errResp, isErr := listResponse.(mcp.JSONRPCError); isErr {
				return nil, fmt.Errorf("error listing prompts: %s", errResp.Error.Message)
			}

			// Parse response to get prompts list
			jsonResp, ok := listResponse.(mcp.JSONRPCResponse)
			if !ok {
				return nil, fmt.Errorf("unexpected response type from list prompts")
			}

			// Just return the raw result if we don't need filtering
			if prefix == "" {
				r, err := json.Marshal(jsonResp.Result)
				if err != nil {
					return nil, fmt.Errorf("failed to marshal result: %w", err)
				}
				return mcp.NewToolResultText(string(r)), nil
			}

			// If we have a prefix, we need to extract and filter the prompts
			var listResult map[string]interface{}
			resultBytes, err := json.Marshal(jsonResp.Result)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal result: %w", err)
			}

			if err := json.Unmarshal(resultBytes, &listResult); err != nil {
				return nil, fmt.Errorf("failed to unmarshal result: %w", err)
			}

			// Filter prompts by prefix if specified
			if promptsList, ok := listResult["prompts"].([]interface{}); ok {
				filtered := make([]interface{}, 0)
				for _, p := range promptsList {
					if prompt, ok := p.(map[string]interface{}); ok {
						if name, ok := prompt["name"].(string); ok {
							if strings.HasPrefix(name, prefix) {
								filtered = append(filtered, prompt)
							}
						}
					}
				}
				listResult["prompts"] = filtered
			}

			r, err := json.Marshal(listResult)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal filtered results: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetPromptTool creates a tool for retrieving a single prompt from the MCP server
func GetPromptTool(config *config.McpServerConfig) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_prompt",
			mcp.WithDescription("Retrieves a specific prompt from the MCP server by name"),
			mcp.WithString("prompt_name",
				mcp.Description("The name of the prompt to retrieve"),
				mcp.Required(),
			),
			mcp.WithString("mode",
				mcp.Description("Optional mode to retrieve a specific version of the prompt"),
				mcp.Enum("CI", "CD", "CCM", "SEI", "STO", "IDP", "IACM", "SRM", "SCS", "CE", "AR", "FME", "DBDEVOPS"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Get MCP server from context
			mcpServer := server.ServerFromContext(ctx)
			if mcpServer == nil {
				return nil, fmt.Errorf("MCP server not found in context")
			}

			// Extract prompt name parameter
			promptName, err := RequiredParam[string](request, "prompt_name")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Extract optional mode parameter
			mode, err := OptionalParam[string](request, "mode")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Create arguments map for the request
			arguments := make(map[string]interface{})
			if mode != "" {
				arguments["mode"] = mode
			}

			// Create a get prompt request
			getRequest := map[string]interface{}{
				"jsonrpc": "2.0",
				"id":      "internal-get-prompt",
				"method":  "prompts/get",
				"params": map[string]interface{}{
					"name":      promptName,
					"arguments": arguments,
				},
			}

			// Convert to JSON
			getRequestBytes, err := json.Marshal(getRequest)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal get prompt request: %w", err)
			}

			// Send through HandleMessage
			getResponse := mcpServer.HandleMessage(ctx, getRequestBytes)

			// Check for error
			if errResp, isErr := getResponse.(mcp.JSONRPCError); isErr {
				slog.ErrorContext(ctx, "error getting prompt", "error", errResp.Error.Message)
				return mcp.NewToolResultText(string("")), nil
			}

			// Parse response
			jsonResp, ok := getResponse.(mcp.JSONRPCResponse)
			if !ok {
				slog.ErrorContext(ctx, "unexpected response type from get prompt")
				return mcp.NewToolResultText(string("")), nil
			}

			// Return the result as JSON string
			r, err := json.Marshal(jsonResp.Result)
			if err != nil {
				slog.ErrorContext(ctx, "failed to marshal result", "error", err.Error())
				return mcp.NewToolResultText(string("")), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}
