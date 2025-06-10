package harness

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// GetDashboardMetricsTool creates a tool for getting policy dashboard metrics
// https://apidocs.harness.io/tag/dashboard#operation/dashboard_metrics
func GetPolicyDashboardMetricsTool(config *config.Config, client *client.PolicyClient) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_policy_dashboard_metrics",
			mcp.WithDescription("Get policy dashboard metrics from Harness."),
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.GetDashboardMetrics(ctx, scope)
			if err != nil {
				return nil, fmt.Errorf("failed to get dashboard metrics: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal dashboard metrics: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// ListEvaluationsTool creates a tool for listing policy evaluations
// https://apidocs.harness.io/tag/evaluations#operation/evaluations_list
func ListPolicyEvaluationsTool(config *config.Config, client *client.PolicyClient) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_policy_evaluations",
			mcp.WithDescription("List policy evaluations in Harness."),
			mcp.WithString("status",
				mcp.Description("Optional filter for evaluation status (e.g., PASSED, FAILED)"),
			),
			mcp.WithString("result",
				mcp.Description("Optional filter for evaluation result"),
			),
			mcp.WithNumber("time_range_days",
				mcp.Description("Optional parameter to filter evaluations from the last N days"),
			),
			mcp.WithString("sort",
				mcp.Description("Optional field to sort by (e.g., createdAt)"),
			),
			mcp.WithString("order",
				mcp.Description("Optional sort order (asc or desc)"),
			),
			mcp.WithNumber("page",
				mcp.DefaultNumber(0),
				mcp.Description("Page number for pagination (0-based)"),
			),
			mcp.WithNumber("limit",
				mcp.DefaultNumber(5),
				mcp.Max(20),
				mcp.Description("Number of evaluations per page"),
			),
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			opts := &dto.PolicyOptions{}

			// Handle pagination
			page, err := OptionalParam[float64](request, "page")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if page >= 0 {
				opts.Page = int(page)
			}

			limit, err := OptionalParam[float64](request, "limit")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if limit > 0 {
				opts.Limit = int(limit)
			}

			// Handle filters
			status, err := OptionalParam[string](request, "status")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if status != "" {
				opts.Status = status
			}

			result, err := OptionalParam[string](request, "result")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if result != "" {
				opts.Result = result
			}

			// Handle time range filter
			timeRange, err := OptionalParam[float64](request, "time_range_days")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if timeRange > 0 {
				now := time.Now()
				opts.EndTime = now.UnixMilli()
				opts.StartTime = now.AddDate(0, 0, -int(timeRange)).UnixMilli()
			}

			// Handle sorting
			sort, err := OptionalParam[string](request, "sort")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if sort != "" {
				opts.Sort = sort
			}

			order, err := OptionalParam[string](request, "order")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if order != "" {
				opts.Order = order
			}

			evaluations, totalCount, err := client.ListEvaluations(ctx, scope, opts)
			if err != nil {
				return nil, fmt.Errorf("failed to list policy evaluations: %w", err)
			}

			// Create response with evaluations and metadata
			response := map[string]interface{}{
				"evaluations": evaluations,
				"totalCount":  totalCount,
				"pageSize":    opts.Limit,
				"pageNumber":  opts.Page,
			}

			r, err := json.Marshal(response)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal evaluations list: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}
