package tools

import (
	"context"
	"encoding/json"
	"fmt"

	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/client"
	"github.com/harness/mcp-server/common/client/dto"
	"github.com/harness/mcp-server/common/pkg/common"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// ListLoadTestsTool creates a tool for listing load tests
func ListLoadTestsTool(config *config.McpServerConfig, client *client.LoadTestService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("loadtest_list",
			mcp.WithDescription("List all load tests in the project"),
			common.WithScope(config, false),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page, size, err := FetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			pagination := &dto.PaginationOptions{
				Page: page,
				Size: size,
			}

			data, err := client.ListLoadTests(ctx, scope, pagination)
			if err != nil {
				return nil, fmt.Errorf("failed to list load tests: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal list load tests response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetLoadTestTool creates a tool for getting details of a specific load test
func GetLoadTestTool(config *config.McpServerConfig, client *client.LoadTestService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("loadtest_describe",
			mcp.WithDescription("Get details of a specific load test, including its configuration, target URL, script content, and recent runs"),
			common.WithScope(config, false),
			mcp.WithString("load_test_id",
				mcp.Description("The unique identifier of the load test"),
				mcp.Required(),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			loadTestID, err := RequiredParam[string](request, "load_test_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.GetLoadTest(ctx, scope, loadTestID)
			if err != nil {
				return nil, fmt.Errorf("failed to get load test: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal load test response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}
