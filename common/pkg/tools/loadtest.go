package tools

import (
	"context"
	"encoding/json"
	"fmt"

	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/client"
	"github.com/harness/mcp-server/common/client/dto"
	"github.com/harness/mcp-server/common/pkg/chaoscommons"
	"github.com/harness/mcp-server/common/pkg/common"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// ListLoadTestsTool creates a tool for listing load tests
func ListLoadTestsTool(config *config.McpServerConfig, client *client.LoadTestService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool(chaoscommons.ToolListLoadTestInstances,
			mcp.WithDescription(chaoscommons.DescToolListLoadTestInstances),
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
	return mcp.NewTool(chaoscommons.ToolGetLoadTestInstance,
			mcp.WithDescription(chaoscommons.DescToolGetLoadTestInstance),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamLoadTestID,
				mcp.Description(chaoscommons.DescLoadTestID),
				mcp.Required(),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			loadTestID, err := RequiredParam[string](request, chaoscommons.ParamLoadTestID)
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
	return mcp.NewTool(chaoscommons.ToolRunLoadTestInstance,
			mcp.WithDescription(chaoscommons.DescToolRunLoadTestInstance),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamLoadTestID,
				mcp.Description(chaoscommons.DescLoadTestIDRun),
				mcp.Required(),
			),
			mcp.WithNumber(chaoscommons.ParamTargetUsers,
				mcp.Description(chaoscommons.DescTargetUsers),
			),
			mcp.WithNumber(chaoscommons.ParamDurationSeconds,
				mcp.Description(chaoscommons.DescDurationSeconds),
			),
			mcp.WithNumber(chaoscommons.ParamSpawnRate,
				mcp.Description(chaoscommons.DescSpawnRate),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			loadTestID, err := RequiredParam[string](request, chaoscommons.ParamLoadTestID)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			targetUsers, err := OptionalIntParam(request, chaoscommons.ParamTargetUsers)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			durationSeconds, err := OptionalIntParam(request, chaoscommons.ParamDurationSeconds)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			spawnRate, err := OptionalIntParam(request, chaoscommons.ParamSpawnRate)
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
	return mcp.NewTool(chaoscommons.ToolStopLoadTestRun,
			mcp.WithDescription(chaoscommons.DescToolStopLoadTestRun),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamRunID,
				mcp.Description(chaoscommons.DescRunID),
				mcp.Required(),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			runID, err := RequiredParam[string](request, chaoscommons.ParamRunID)
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
	return mcp.NewTool(chaoscommons.ToolDeleteLoadTestInstance,
			mcp.WithDescription(chaoscommons.DescToolDeleteLoadTestInstance),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamLoadTestID,
				mcp.Description(chaoscommons.DescLoadTestIDDelete),
				mcp.Required(),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			loadTestID, err := RequiredParam[string](request, chaoscommons.ParamLoadTestID)
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
	return mcp.NewTool(chaoscommons.ToolCreateSampleLoadTest,
			mcp.WithDescription(chaoscommons.DescToolCreateSampleLoadTest),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamName,
				mcp.Description(chaoscommons.DescLoadTestName),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamInfraIDLoadTest,
				mcp.Description(chaoscommons.DescLoadTestInfraID),
				mcp.Required(),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			name, err := RequiredParam[string](request, chaoscommons.ParamName)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			infraID, err := RequiredParam[string](request, chaoscommons.ParamInfraIDLoadTest)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			createRequest := &dto.CreateSampleLoadTestRequest{
				Name:          name,
				UseSampleTest: true,
				InfraID:       infraID,
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
