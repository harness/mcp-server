package harness

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// ListExperimentsTool creates a tool for listing the experiments
func ListExperimentsTool(config *config.Config, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_experiments_list",
			mcp.WithDescription("List the chaos experiments"),
			WithScope(config, false),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page, size, err := fetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			pagination := &dto.PaginationOptions{
				Page: page,
				Size: size,
			}

			data, err := client.ListExperiments(ctx, scope, pagination)
			if err != nil {
				return nil, fmt.Errorf("failed to list experiments: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal list experiment response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetExperimentsTool creates a tool to get the experiment details
func GetExperimentsTool(config *config.Config, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_experiment_describe",
			mcp.WithDescription("Retrieves information about chaos experiment, allowing users to get an overview and detailed insights for each experiment"),
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			experimentID, err := requiredParam[string](request, "experimentID")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.GetExperiment(ctx, scope, experimentID)
			if err != nil {
				return nil, fmt.Errorf("failed to get experiment: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal get experiment response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetExperimentRunsTool creates a tool to get the experiment run details
func GetExperimentRunsTool(config *config.Config, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_experiment_run_result",
			mcp.WithDescription("Retrieves run result of chaos experiment runs, helping to describe and summarize the details of each experiment run"),
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			experimentID, err := requiredParam[string](request, "experimentID")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			experimentRunID, err := requiredParam[string](request, "experimentRunId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.GetExperimentRun(ctx, scope, experimentID, experimentRunID)
			if err != nil {
				return nil, fmt.Errorf("failed to get experiment run: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal get experiment run response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// RunExperimentTool creates a tool to run the experiment
func RunExperimentTool(config *config.Config, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_experiment_run",
			mcp.WithDescription("Run the chaos experiment"),
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			experimentID, err := requiredParam[string](request, "experimentID")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.RunExperiment(ctx, scope, experimentID)
			if err != nil {
				return nil, fmt.Errorf("failed to run experiment: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal run experiment response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}
