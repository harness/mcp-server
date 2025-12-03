package tools

import (
	"context"
	"encoding/json"
	"fmt"

	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/client"
	"github.com/harness/mcp-server/common/pkg/common"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// ===== BA Controller Tools =====

// GetBAAllProfilesTool creates a tool for getting all BA profiles
func GetBAAllProfilesTool(config *config.Config, client *client.SEIService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_get_ba_all_profiles",
			mcp.WithDescription("Get all BA profiles"),
			common.WithScope(config, true),
			mcp.WithString("accountId",
				mcp.Required(),
				mcp.Description("Harness Account ID"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Required params
			accountID, err := RequiredParam[string](request, "accountId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			scope, err := common.FetchScope(ctx, config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Build params map
			requestParams := map[string]interface{}{
				"accountId": accountID,
				"projectId": scope.ProjectID,
				"orgId":     scope.OrgID,
			}

			// Call API
			resp, err := client.GetBAAllProfiles(ctx, requestParams)
			if err != nil {
				return nil, fmt.Errorf("failed to get BA all profiles: %w", err)
			}

			// Marshal the response to JSON
			r, err := json.Marshal(resp)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal BA all profiles: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetBAInsightMetricsTool creates a tool for getting BA insight metrics
func GetBAInsightMetricsTool(config *config.Config, client *client.SEIService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_get_ba_insight_metrics",
			mcp.WithDescription("Get BA insight metrics"),
			common.WithScope(config, true),
			mcp.WithString("accountId",
				mcp.Required(),
				mcp.Description("Harness Account ID"),
			),
			mcp.WithObject("request",
				mcp.Required(),
				mcp.Description("BAInsightRequestDTO object with request parameters"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Required params
			accountID, err := RequiredParam[string](request, "accountId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			scope, err := common.FetchScope(ctx, config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			requestData, err := RequiredParam[interface{}](request, "request")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Build params map
			requestParams := map[string]interface{}{
				"accountId": accountID,
				"projectId": scope.ProjectID,
				"orgId":     scope.OrgID,
				"request":   requestData,
			}

			// Call API
			resp, err := client.GetBAInsightMetrics(ctx, requestParams)
			if err != nil {
				return nil, fmt.Errorf("failed to get BA insight metrics: %w", err)
			}

			// Marshal the response to JSON
			r, err := json.Marshal(resp)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal BA insight metrics: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetBAInsightSummaryTool creates a tool for getting BA insight summary
func GetBAInsightSummaryTool(config *config.Config, client *client.SEIService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_get_ba_insight_summary",
			mcp.WithDescription("Get BA insight summary"),
			common.WithScope(config, true),
			mcp.WithString("accountId",
				mcp.Required(),
				mcp.Description("Harness Account ID"),
			),
			mcp.WithObject("request",
				mcp.Required(),
				mcp.Description("BASummaryRequestDTO object with request parameters"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Required params
			accountID, err := RequiredParam[string](request, "accountId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			scope, err := common.FetchScope(ctx, config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			requestData, err := RequiredParam[interface{}](request, "request")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Build params map
			requestParams := map[string]interface{}{
				"accountId": accountID,
				"projectId": scope.ProjectID,
				"orgId":     scope.OrgID,
				"request":   requestData,
			}

			// Call API
			resp, err := client.GetBAInsightSummary(ctx, requestParams)
			if err != nil {
				return nil, fmt.Errorf("failed to get BA insight summary: %w", err)
			}

			// Marshal the response to JSON
			r, err := json.Marshal(resp)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal BA insight summary: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetBADrilldownDataTool creates a tool for getting BA drilldown data
func GetBADrilldownDataTool(config *config.Config, client *client.SEIService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_get_ba_drilldown_data",
			mcp.WithDescription("Get BA drilldown data"),
			common.WithScope(config, true),
			mcp.WithString("accountId",
				mcp.Required(),
				mcp.Description("Harness Account ID"),
			),
			mcp.WithObject("request",
				mcp.Required(),
				mcp.Description("BADrilldownRequestDTO object with request parameters"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Required params
			accountID, err := RequiredParam[string](request, "accountId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			scope, err := common.FetchScope(ctx, config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			requestData, err := RequiredParam[interface{}](request, "request")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Build params map
			requestParams := map[string]interface{}{
				"accountId": accountID,
				"projectId": scope.ProjectID,
				"orgId":     scope.OrgID,
				"request":   requestData,
			}

			// Call API
			resp, err := client.GetBADrilldownData(ctx, requestParams)
			if err != nil {
				return nil, fmt.Errorf("failed to get BA drilldown data: %w", err)
			}

			// Marshal the response to JSON
			r, err := json.Marshal(resp)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal BA drilldown data: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}
