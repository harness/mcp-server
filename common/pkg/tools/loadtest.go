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

// RunLoadTestTool creates a tool for running a load test
func RunLoadTestTool(config *config.McpServerConfig, client *client.LoadTestService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("loadtest_run",
			mcp.WithDescription("Run a load test. If target_users, duration_seconds, or spawn_rate are not provided, the load test's default values will be used."),
			common.WithScope(config, false),
			mcp.WithString("load_test_id",
				mcp.Description("The unique identifier of the load test to run"),
				mcp.Required(),
			),
			mcp.WithNumber("target_users",
				mcp.Description("Number of concurrent users to simulate"),
			),
			mcp.WithNumber("duration_seconds",
				mcp.Description("Duration of the load test in seconds"),
			),
			mcp.WithNumber("spawn_rate",
				mcp.Description("Rate at which users are spawned per second"),
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

			targetUsers, err := OptionalIntParam(request, "target_users")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			durationSeconds, err := OptionalIntParam(request, "duration_seconds")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			spawnRate, err := OptionalIntParam(request, "spawn_rate")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			runRequest := &dto.RunLoadTestRequest{
				LoadTestID:      loadTestID,
				TargetUsers:     targetUsers,
				DurationSeconds: durationSeconds,
				SpawnRate:       spawnRate,
			}

			data, err := client.RunLoadTest(ctx, scope, loadTestID, runRequest)
			if err != nil {
				return nil, fmt.Errorf("failed to run load test: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal run load test response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// StopLoadTestTool creates a tool for stopping a running load test
func StopLoadTestTool(config *config.McpServerConfig, client *client.LoadTestService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("loadtest_stop",
			mcp.WithDescription("Stop a running load test run"),
			common.WithScope(config, false),
			mcp.WithString("run_id",
				mcp.Description("The unique identifier of the load test run to stop"),
				mcp.Required(),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			runID, err := RequiredParam[string](request, "run_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.StopLoadTest(ctx, scope, runID)
			if err != nil {
				return nil, fmt.Errorf("failed to stop load test run: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal stop load test response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// DeleteLoadTestTool creates a tool for deleting a load test
func DeleteLoadTestTool(config *config.McpServerConfig, client *client.LoadTestService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("loadtest_delete",
			mcp.WithDescription("Delete a load test"),
			common.WithScope(config, false),
			mcp.WithString("load_test_id",
				mcp.Description("The unique identifier of the load test to delete"),
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

			data, err := client.DeleteLoadTest(ctx, scope, loadTestID)
			if err != nil {
				return nil, fmt.Errorf("failed to delete load test: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal delete load test response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// CreateSampleLoadTestTool creates a tool for creating a sample load test
func CreateSampleLoadTestTool(config *config.McpServerConfig, client *client.LoadTestService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("loadtest_create_sample",
			mcp.WithDescription("Create a sample load test. Requires a name and a load runner infrastructure ID (use loadtest_list_infra to find available infrastructure)."),
			common.WithScope(config, false),
			mcp.WithString("name",
				mcp.Description("Name for the new sample load test"),
				mcp.Required(),
			),
			mcp.WithString("locust_cluster_id",
				mcp.Description("The infrastructure ID of the load runner to use (get from loadtest_list_infra)"),
				mcp.Required(),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			name, err := RequiredParam[string](request, "name")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			clusterID, err := RequiredParam[string](request, "locust_cluster_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			createRequest := &dto.CreateSampleLoadTestRequest{
				Name:            name,
				UseSampleTest:   true,
				LocustClusterID: clusterID,
			}

			data, err := client.CreateSampleLoadTest(ctx, scope, createRequest)
			if err != nil {
				return nil, fmt.Errorf("failed to create sample load test: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal create sample load test response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}
