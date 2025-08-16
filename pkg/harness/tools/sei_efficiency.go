package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// GetEfficiencyLeadTimeTool creates a tool for getting lead time
func GetEfficiencyLeadTimeTool(config *config.Config, client *client.SEIService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_efficiency_lead_time",
			mcp.WithDescription("Get lead time for a project"),
			WithScope(config, true),
			mcp.WithString("accountId",
				mcp.Required(),
				mcp.Description("Harness Account ID"),
			),
			mcp.WithString("teamRefId",
				mcp.Required(),
				mcp.Description("Team reference ID for the metrics"),
			),
			mcp.WithString("dateStart",
				mcp.Required(),
				mcp.Description("Start date for metrics in YYYY-MM-DD format"),
			),
			mcp.WithString("dateEnd",
				mcp.Required(),
				mcp.Description("End date for metrics in YYYY-MM-DD format"),
			),
			mcp.WithString("granularity",
				mcp.Required(),
				mcp.Description("Time granularity for the metrics (e.g., DAILY, WEEKLY, MONTHLY)"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Required params
			accountID, err := RequiredParam[string](request, "accountId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			scope, err := FetchScope(config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			teamRefId, err := RequiredParam[string](request, "teamRefId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			dateStart, err := RequiredParam[string](request, "dateStart")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			dateEnd, err := RequiredParam[string](request, "dateEnd")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			granularity, err := RequiredParam[string](request, "granularity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Build params map for additional parameters
			requestParams := map[string]interface{}{
				"accountId":   accountID,
				"orgId":       scope.OrgID,
				"projectId":   scope.ProjectID,
				"teamRefId":   teamRefId,
				"dateStart":   dateStart,
				"dateEnd":     dateEnd,
				"granularity": granularity,
			}

			// Optional params
			if drillDownStartDate, ok, err := OptionalParamOK[string](request, "drillDownStartDate"); ok && err == nil && drillDownStartDate != "" {
				requestParams["drillDownStartDate"] = drillDownStartDate
			}
			if drillDownEndDate, ok, err := OptionalParamOK[string](request, "drillDownEndDate"); ok && err == nil && drillDownEndDate != "" {
				requestParams["drillDownEndDate"] = drillDownEndDate
			}
			if page, ok, err := OptionalParamOK[float64](request, "page"); ok && err == nil {
				requestParams["page"] = int(page)
			}
			if pageSize, ok, err := OptionalParamOK[float64](request, "pageSize"); ok && err == nil {
				requestParams["pageSize"] = int(pageSize)
			}

			// Call API
			resp, err := client.GetEfficiencyLeadTime(ctx, requestParams)
			if err != nil {
				return nil, fmt.Errorf("failed to get lead time: %w", err)
			}

			// Marshal the response to JSON
			r, err := json.Marshal(resp)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal lead time: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetDeploymentFrequencyTool creates a tool for getting deployment frequency metrics
func GetDeploymentFrequencyTool(config *config.Config, client *client.SEIService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_deployment_frequency",
			mcp.WithDescription("Get deployment frequency metrics for a project"),
			WithScope(config, true),
			mcp.WithString("accountId",
				mcp.Required(),
				mcp.Description("Harness Account ID"),
			),
			mcp.WithString("teamRefId",
				mcp.Required(),
				mcp.Description("Team reference ID for the metrics"),
			),
			mcp.WithString("dateStart",
				mcp.Required(),
				mcp.Description("Start date for metrics in YYYY-MM-DD format"),
			),
			mcp.WithString("dateEnd",
				mcp.Required(),
				mcp.Description("End date for metrics in YYYY-MM-DD format"),
			),
			mcp.WithString("granularity",
				mcp.Required(),
				mcp.Description("Time granularity for the metrics (e.g., DAILY, WEEKLY, MONTHLY)"),
			),
			mcp.WithString("drillDownStartDate",
				mcp.Description("Optional drill down start date in YYYY-MM-DD format"),
			),
			mcp.WithString("drillDownEndDate",
				mcp.Description("Optional drill down end date in YYYY-MM-DD format"),
			),
			mcp.WithNumber("page",
				mcp.Description("Page number for pagination"),
			),
			mcp.WithNumber("pageSize",
				mcp.Description("Page size for pagination"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Required params
			accountID, err := RequiredParam[string](request, "accountId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			scope, err := FetchScope(config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			teamRefId, err := RequiredParam[string](request, "teamRefId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			dateStart, err := RequiredParam[string](request, "dateStart")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			dateEnd, err := RequiredParam[string](request, "dateEnd")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			granularity, err := RequiredParam[string](request, "granularity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Build request parameters
			requestParams := map[string]interface{}{
				"accountId":   accountID,
				"orgId":       scope.OrgID,
				"projectId":   scope.ProjectID,
				"teamRefId":   teamRefId,
				"dateStart":   dateStart,
				"dateEnd":     dateEnd,
				"granularity": granularity,
			}

			// Optional params
			if drillDownStartDate, ok, err := OptionalParamOK[string](request, "drillDownStartDate"); ok && err == nil && drillDownStartDate != "" {
				requestParams["drillDownStartDate"] = drillDownStartDate
			}
			if drillDownEndDate, ok, err := OptionalParamOK[string](request, "drillDownEndDate"); ok && err == nil && drillDownEndDate != "" {
				requestParams["drillDownEndDate"] = drillDownEndDate
			}
			if page, ok, err := OptionalParamOK[float64](request, "page"); ok && err == nil {
				requestParams["page"] = int(page)
			}
			if pageSize, ok, err := OptionalParamOK[float64](request, "pageSize"); ok && err == nil {
				requestParams["pageSize"] = int(pageSize)
			}

			// Call API
			resp, err := client.GetDeploymentFrequency(ctx, requestParams)
			if err != nil {
				return nil, fmt.Errorf("failed to get deployment frequency: %w", err)
			}

			// Marshal the response to JSON
			r, err := json.Marshal(resp)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal deployment frequency: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetChangeFailureRateTool creates a tool for getting change failure rate metrics
func GetChangeFailureRateTool(config *config.Config, client *client.SEIService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_change_failure_rate",
			mcp.WithDescription("Get change failure rate metrics for a project"),
			WithScope(config, true),
			mcp.WithString("accountId",
				mcp.Required(),
				mcp.Description("Harness Account ID"),
			),
			mcp.WithString("teamRefId",
				mcp.Required(),
				mcp.Description("Team reference ID for the metrics"),
			),
			mcp.WithString("dateStart",
				mcp.Required(),
				mcp.Description("Start date for metrics in YYYY-MM-DD format"),
			),
			mcp.WithString("dateEnd",
				mcp.Required(),
				mcp.Description("End date for metrics in YYYY-MM-DD format"),
			),
			mcp.WithString("granularity",
				mcp.Required(),
				mcp.Description("Time granularity for the metrics (e.g., DAILY, WEEKLY, MONTHLY)"),
			),
			mcp.WithString("drillDownStartDate",
				mcp.Description("Optional drill down start date in YYYY-MM-DD format"),
			),
			mcp.WithString("drillDownEndDate",
				mcp.Description("Optional drill down end date in YYYY-MM-DD format"),
			),
			mcp.WithNumber("page",
				mcp.Description("Page number for pagination"),
			),
			mcp.WithNumber("pageSize",
				mcp.Description("Page size for pagination"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Required params
			accountID, err := RequiredParam[string](request, "accountId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			scope, err := FetchScope(config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			teamRefId, err := RequiredParam[string](request, "teamRefId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			dateStart, err := RequiredParam[string](request, "dateStart")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			dateEnd, err := RequiredParam[string](request, "dateEnd")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			granularity, err := RequiredParam[string](request, "granularity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Build request parameters
			requestParams := map[string]interface{}{
				"accountId":   accountID,
				"orgId":       scope.OrgID,
				"projectId":   scope.ProjectID,
				"teamRefId":   teamRefId,
				"dateStart":   dateStart,
				"dateEnd":     dateEnd,
				"granularity": granularity,
			}

			// Optional params
			if drillDownStartDate, ok, err := OptionalParamOK[string](request, "drillDownStartDate"); ok && err == nil && drillDownStartDate != "" {
				requestParams["drillDownStartDate"] = drillDownStartDate
			}
			if drillDownEndDate, ok, err := OptionalParamOK[string](request, "drillDownEndDate"); ok && err == nil && drillDownEndDate != "" {
				requestParams["drillDownEndDate"] = drillDownEndDate
			}
			if page, ok, err := OptionalParamOK[float64](request, "page"); ok && err == nil {
				requestParams["page"] = int(page)
			}
			if pageSize, ok, err := OptionalParamOK[float64](request, "pageSize"); ok && err == nil {
				requestParams["pageSize"] = int(pageSize)
			}

			// Call API
			resp, err := client.GetChangeFailureRate(ctx, requestParams)
			if err != nil {
				return nil, fmt.Errorf("failed to get change failure rate: %w", err)
			}

			// Marshal the response to JSON
			r, err := json.Marshal(resp)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal change failure rate: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetMttrTool creates a tool for getting Mean Time to Restore metrics
func GetMttrTool(config *config.Config, client *client.SEIService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_mttr",
			mcp.WithDescription("Get Mean Time to Restore metrics for a project"),
			WithScope(config, true),
			mcp.WithString("accountId",
				mcp.Required(),
				mcp.Description("Harness Account ID"),
			),
			mcp.WithString("teamRefId",
				mcp.Required(),
				mcp.Description("Team reference ID for the metrics"),
			),
			mcp.WithString("dateStart",
				mcp.Required(),
				mcp.Description("Start date for metrics in YYYY-MM-DD format"),
			),
			mcp.WithString("dateEnd",
				mcp.Required(),
				mcp.Description("End date for metrics in YYYY-MM-DD format"),
			),
			mcp.WithString("granularity",
				mcp.Required(),
				mcp.Description("Time granularity for the metrics (e.g., DAILY, WEEKLY, MONTHLY)"),
			),
			mcp.WithString("drillDownStartDate",
				mcp.Description("Optional drill down start date in YYYY-MM-DD format"),
			),
			mcp.WithString("drillDownEndDate",
				mcp.Description("Optional drill down end date in YYYY-MM-DD format"),
			),
			mcp.WithNumber("page",
				mcp.Description("Page number for pagination"),
			),
			mcp.WithNumber("pageSize",
				mcp.Description("Page size for pagination"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Required params
			accountID, err := RequiredParam[string](request, "accountId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			scope, err := FetchScope(config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			teamRefId, err := RequiredParam[string](request, "teamRefId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			dateStart, err := RequiredParam[string](request, "dateStart")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			dateEnd, err := RequiredParam[string](request, "dateEnd")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			granularity, err := RequiredParam[string](request, "granularity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Build params map for additional parameters
			requestParams := map[string]interface{}{
				"accountId":   accountID,
				"orgId":       scope.OrgID,
				"projectId":   scope.ProjectID,
				"teamRefId":   teamRefId,
				"dateStart":   dateStart,
				"dateEnd":     dateEnd,
				"granularity": granularity,
			}

			// Optional params
			if drillDownStartDate, ok, err := OptionalParamOK[string](request, "drillDownStartDate"); ok && err == nil && drillDownStartDate != "" {
				requestParams["drillDownStartDate"] = drillDownStartDate
			}
			if drillDownEndDate, ok, err := OptionalParamOK[string](request, "drillDownEndDate"); ok && err == nil && drillDownEndDate != "" {
				requestParams["drillDownEndDate"] = drillDownEndDate
			}
			if page, ok, err := OptionalParamOK[float64](request, "page"); ok && err == nil {
				requestParams["page"] = int(page)
			}
			if pageSize, ok, err := OptionalParamOK[float64](request, "pageSize"); ok && err == nil {
				requestParams["pageSize"] = int(pageSize)
			}

			// Call API
			resp, err := client.GetMttr(ctx, requestParams)
			if err != nil {
				return nil, fmt.Errorf("failed to get MTTR: %w", err)
			}

			// Marshal the response to JSON
			r, err := json.Marshal(resp)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal MTTR: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetDeploymentFrequencyDrilldownTool creates a tool for getting deployment frequency drilldown data
func GetDeploymentFrequencyDrilldownTool(config *config.Config, client *client.SEIService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_deployment_frequency_drilldown",
			mcp.WithDescription("Get deployment frequency drilldown data for detailed pipeline executions"),
			WithScope(config, true),
			mcp.WithString("accountId",
				mcp.Required(),
				mcp.Description("Harness Account ID"),
			),
			mcp.WithString("teamRefId",
				mcp.Required(),
				mcp.Description("Team reference ID for the drilldown data"),
			),
			mcp.WithString("dateStart",
				mcp.Required(),
				mcp.Description("Start date for drilldown data in YYYY-MM-DD format"),
			),
			mcp.WithString("dateEnd",
				mcp.Required(),
				mcp.Description("End date for drilldown data in YYYY-MM-DD format"),
			),
			mcp.WithString("sortOption",
				mcp.Description("Optional sort option for the results"),
			),
			mcp.WithNumber("page",
				mcp.Description("Page number for pagination"),
			),
			mcp.WithNumber("pageSize",
				mcp.Description("Page size for pagination"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Required params
			accountID, err := RequiredParam[string](request, "accountId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			scope, err := FetchScope(config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			teamRefId, err := RequiredParam[string](request, "teamRefId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			dateStart, err := RequiredParam[string](request, "dateStart")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			dateEnd, err := RequiredParam[string](request, "dateEnd")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Build request parameters
			requestParams := map[string]interface{}{
				"accountId": accountID,
				"orgId":     scope.OrgID,
				"projectId": scope.ProjectID,
				"teamRefId": teamRefId,
				"dateStart": dateStart,
				"dateEnd":   dateEnd,
			}

			// Optional params
			if sortOption, ok, err := OptionalParamOK[string](request, "sortOption"); ok && err == nil && sortOption != "" {
				requestParams["sortOption"] = sortOption
			}
			if page, ok, err := OptionalParamOK[float64](request, "page"); ok && err == nil {
				requestParams["page"] = int(page)
			}
			if pageSize, ok, err := OptionalParamOK[float64](request, "pageSize"); ok && err == nil {
				requestParams["pageSize"] = int(pageSize)
			}

			// Call API
			resp, err := client.GetDeploymentFrequencyDrilldown(ctx, requestParams)
			if err != nil {
				return nil, fmt.Errorf("failed to get deployment frequency drilldown: %w", err)
			}

			// Marshal the response to JSON
			r, err := json.Marshal(resp)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal deployment frequency drilldown: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetChangeFailureRateDrilldownTool creates a tool for getting change failure rate drilldown data
func GetChangeFailureRateDrilldownTool(config *config.Config, client *client.SEIService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_change_failure_rate_drilldown",
			mcp.WithDescription("Get change failure rate drilldown data for detailed deployment records with failure status"),
			WithScope(config, true),
			mcp.WithString("accountId",
				mcp.Required(),
				mcp.Description("Harness Account ID"),
			),
			mcp.WithString("teamRefId",
				mcp.Required(),
				mcp.Description("Team reference ID for the drilldown data"),
			),
			mcp.WithString("dateStart",
				mcp.Required(),
				mcp.Description("Start date for drilldown data in YYYY-MM-DD format"),
			),
			mcp.WithString("dateEnd",
				mcp.Required(),
				mcp.Description("End date for drilldown data in YYYY-MM-DD format"),
			),
			mcp.WithString("sortOption",
				mcp.Description("Optional sort option for the results"),
			),
			mcp.WithNumber("page",
				mcp.Description("Page number for pagination"),
			),
			mcp.WithNumber("pageSize",
				mcp.Description("Page size for pagination"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Required params
			accountID, err := RequiredParam[string](request, "accountId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			scope, err := FetchScope(config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			teamRefId, err := RequiredParam[string](request, "teamRefId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			dateStart, err := RequiredParam[string](request, "dateStart")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			dateEnd, err := RequiredParam[string](request, "dateEnd")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Build request parameters
			requestParams := map[string]interface{}{
				"accountId": accountID,
				"orgId":     scope.OrgID,
				"projectId": scope.ProjectID,
				"teamRefId": teamRefId,
				"dateStart": dateStart,
				"dateEnd":   dateEnd,
			}

			// Optional params
			if sortOption, ok, err := OptionalParamOK[string](request, "sortOption"); ok && err == nil && sortOption != "" {
				requestParams["sortOption"] = sortOption
			}
			if page, ok, err := OptionalParamOK[float64](request, "page"); ok && err == nil {
				requestParams["page"] = int(page)
			}
			if pageSize, ok, err := OptionalParamOK[float64](request, "pageSize"); ok && err == nil {
				requestParams["pageSize"] = int(pageSize)
			}

			// Call API
			resp, err := client.GetChangeFailureRateDrilldown(ctx, requestParams)
			if err != nil {
				return nil, fmt.Errorf("failed to get change failure rate drilldown: %w", err)
			}

			// Marshal the response to JSON
			r, err := json.Marshal(resp)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal change failure rate drilldown: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}
