package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/harness/mcp-server/client"
	config "github.com/harness/mcp-server/common"
	commonDto "github.com/harness/mcp-server/common/client/dto"
	commonScopeUtils "github.com/harness/mcp-server/common/pkg/common"
	commonTools "github.com/harness/mcp-server/common/pkg/tools"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// ListLoadTestsTool creates a tool for listing load tests
func ListLoadTestsTool(config *config.McpServerConfig, client *client.LoadTestService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("loadtest_list",
			mcp.WithDescription("List all load tests in the project"),
			commonScopeUtils.WithScope(config, false),
			commonTools.WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := commonScopeUtils.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page, size, err := commonTools.FetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			pagination := &commonDto.PaginationOptions{
				Page: page,
				Size: size,
			}

			data, err := client.ListLoadTests(ctx, scope, pagination)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal list load tests response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

