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

// GetProductivityFeatureMetricsTool creates a tool for getting productivity feature metrics
func GetProductivityFeatureMetricsTool(config *config.Config, client *client.SEIService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_productivity_feature_metrics",
			mcp.WithDescription("Get productivity metrics for a collection"),
			mcp.WithString("accountId",
				mcp.Required(),
				mcp.Description("Harness Account ID"),
			),
			mcp.WithString("orgId",
				mcp.Required(),
				mcp.DefaultString("default"),
				mcp.Description("Harness Organization ID"),
			),
			mcp.WithString("projectId",
				mcp.Required(),
				mcp.DefaultString("SEI_Harness_Prod"),
				mcp.Description("Harness Project ID"),
			),
			mcp.WithString("startDate",
				mcp.Required(),
				mcp.Description("Start date for metrics in YYYY-MM-DD format"),
			),
			mcp.WithString("endDate",
				mcp.Required(),
				mcp.Description("End date for metrics in YYYY-MM-DD format"),
			),
			mcp.WithString("featureType",
				mcp.Required(),
				mcp.DefaultString("PR_VELOCITY"),
				mcp.Description("Type of productivity feature to measure (e.g., PR_VELOCITY)"),
			),
			mcp.WithString("granularity",
				mcp.DefaultString("WEEKLY"),
				mcp.Description("Time granularity for the metrics (e.g., WEEKLY, MONTHLY)"),
			),
			mcp.WithArray("developerIds",
				mcp.Description("List of developer IDs to filter by"),
			),
			mcp.WithArray("developerRefIds",
				mcp.Description("List of developer reference IDs to filter by"),
			),
			mcp.WithArray("teamRefIds",
				mcp.Description("List of team reference IDs to filter by"),
			),
			mcp.WithArray("teamIds",
				mcp.Description("List of team IDs to filter by"),
			),
			mcp.WithString("teamId",
				mcp.Description("Single team ID to filter by"),
			),
			mcp.WithString("stackBy",
				mcp.Description("Dimension to stack the metrics by (e.g., PR_SIZE, WORK_TYPE)"),
			),
			mcp.WithNumber("page",
				mcp.Description("Page number for pagination"),
			),
			mcp.WithNumber("page_size",
				mcp.Description("Number of items per page"),
			),
			mcp.WithString("sortBy",
				mcp.Description("Field to sort results by"),
			),
			mcp.WithString("sortByCriteria",
				mcp.Description("Criteria for sorting (ASC, DESC)"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Required params
			accountID, err := RequiredParam[string](request, "accountId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			orgID, err := RequiredParam[string](request, "orgId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			projectID, err := RequiredParam[string](request, "projectId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			
			// Build params map
			requestParams := map[string]interface{}{
				"accountId": accountID,
				"orgId":     orgID,
				"projectId": projectID,
			}
			
			// Required date parameters
			startDate, err := RequiredParam[string](request, "startDate")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			requestParams["startDate"] = startDate
			
			endDate, err := RequiredParam[string](request, "endDate")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			requestParams["endDate"] = endDate
			
			// Required feature type parameter
			featureType, err := RequiredParam[string](request, "featureType")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			requestParams["featureType"] = featureType
			
			// Optional params
			if granularity, ok, err := OptionalParamOK[string](request, "granularity"); ok && err == nil && granularity != "" {
				requestParams["granularity"] = granularity
			}
			
			if developerIds, ok, err := OptionalParamOK[[]interface{}](request, "developerIds"); ok && err == nil && len(developerIds) > 0 {
				requestParams["developerIds"] = developerIds
			}
			
			if developerRefIds, ok, err := OptionalParamOK[[]interface{}](request, "developerRefIds"); ok && err == nil && len(developerRefIds) > 0 {
				requestParams["developerRefIds"] = developerRefIds
			}
			
			if teamRefIds, ok, err := OptionalParamOK[[]interface{}](request, "teamRefIds"); ok && err == nil && len(teamRefIds) > 0 {
				requestParams["teamRefIds"] = teamRefIds
			}
			
			if teamIds, ok, err := OptionalParamOK[[]interface{}](request, "teamIds"); ok && err == nil && len(teamIds) > 0 {
				requestParams["teamIds"] = teamIds
			}
			
			if teamId, ok, err := OptionalParamOK[string](request, "teamId"); ok && err == nil && teamId != "" {
				requestParams["teamId"] = teamId
			}
			
			if stackBy, ok, err := OptionalParamOK[string](request, "stackBy"); ok && err == nil && stackBy != "" {
				requestParams["stackBy"] = stackBy
			}
			
			// Pagination parameters
			if page, ok, err := OptionalParamOK[float64](request, "page"); ok && err == nil {
				requestParams["page"] = page
			}
			
			if pageSize, ok, err := OptionalParamOK[float64](request, "page_size"); ok && err == nil {
				requestParams["page_size"] = pageSize
			}
			
			// Sorting parameters
			if sortBy, ok, err := OptionalParamOK[string](request, "sortBy"); ok && err == nil && sortBy != "" {
				requestParams["sortBy"] = sortBy
			}
			
			if sortByCriteria, ok, err := OptionalParamOK[string](request, "sortByCriteria"); ok && err == nil && sortByCriteria != "" {
				requestParams["sortByCriteria"] = sortByCriteria
			}
			
			// Call API
			resp, err := client.GetProductivityFeatureMetrics(ctx, requestParams)
			if err != nil {
				return nil, fmt.Errorf("failed to get productivity feature metrics: %w", err)
			}
			
			// Marshal the response to JSON
			r, err := json.Marshal(resp)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal productivity feature metrics: %w", err)
			}
			

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetProductivityFeatureBreakdownTool creates a tool for getting productivity feature breakdown
func GetProductivityFeatureBreakdownTool(config *config.Config, client *client.SEIService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_productivity_feature_breakdown",
			mcp.WithDescription("Get productivity feature breakdown for a collection"),
			mcp.WithString("accountId",
				mcp.Required(),
				mcp.Description("Harness Account ID"),
			),
			mcp.WithString("orgId",
				mcp.Required(),
				mcp.DefaultString("default"),
				mcp.Description("Harness Organization ID"),
			),
			mcp.WithString("projectId",
				mcp.Required(),
				mcp.DefaultString("SEI_Harness_Prod"),
				mcp.Description("Harness Project ID"),
			),
			mcp.WithString("startDate",
				mcp.Description("Start date for metrics in YYYY-MM-DD format"),
			),
			mcp.WithString("endDate",
				mcp.Description("End date for metrics in YYYY-MM-DD format"),
			),
			mcp.WithString("metricType",
				mcp.Description("Type of metric to retrieve"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Required params
			accountID, err := RequiredParam[string](request, "accountId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			orgID, err := RequiredParam[string](request, "orgId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			projectID, err := RequiredParam[string](request, "projectId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Build params map for additional parameters
			requestParams := map[string]interface{}{
				"accountId": accountID,
				"orgId":     orgID,
				"projectId": projectID,
			}

			// Optional params
			if startDate, ok, err := OptionalParamOK[string](request, "startDate"); ok && err == nil && startDate != "" {
				requestParams["startDate"] = startDate
			}
			if endDate, ok, err := OptionalParamOK[string](request, "endDate"); ok && err == nil && endDate != "" {
				requestParams["endDate"] = endDate
			}
			if metricType, ok, err := OptionalParamOK[string](request, "metricType"); ok && err == nil && metricType != "" {
				requestParams["metricType"] = metricType
			}

			// Call API
			resp, err := client.GetProductivityFeatureBreakdown(ctx, requestParams)
			if err != nil {
				return nil, fmt.Errorf("failed to get productivity feature breakdown: %w", err)
			}

			// Marshal the response to JSON
			r, err := json.Marshal(resp)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal productivity feature breakdown: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetProductivityFeatureDrilldownTool creates a tool for getting productivity feature drilldown
func GetProductivityFeatureDrilldownTool(config *config.Config, client *client.SEIService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_productivity_feature_drilldown",
			mcp.WithDescription("Get productivity feature drilldown for a collection"),
			mcp.WithString("accountId",
				mcp.Required(),
				mcp.Description("Harness Account ID"),
			),
			mcp.WithString("orgId",
				mcp.Required(),
				mcp.DefaultString("default"),
				mcp.Description("Harness Organization ID"),
			),
			mcp.WithString("projectId",
				mcp.Required(),
				mcp.DefaultString("SEI_Harness_Prod"),
				mcp.Description("Harness Project ID"),
			),
			mcp.WithString("startDate",
				mcp.Description("Start date for metrics in YYYY-MM-DD format"),
			),
			mcp.WithString("endDate",
				mcp.Description("End date for metrics in YYYY-MM-DD format"),
			),
			mcp.WithString("metricType",
				mcp.Description("Type of metric to retrieve"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Required params
			accountID, err := RequiredParam[string](request, "accountId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			orgID, err := RequiredParam[string](request, "orgId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			projectID, err := RequiredParam[string](request, "projectId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Build params map for additional parameters
			requestParams := map[string]interface{}{
				"accountId": accountID,
				"orgId":     orgID,
				"projectId": projectID,
			}

			// Optional params
			if startDate, ok, err := OptionalParamOK[string](request, "startDate"); ok && err == nil && startDate != "" {
				requestParams["startDate"] = startDate
			}
			if endDate, ok, err := OptionalParamOK[string](request, "endDate"); ok && err == nil && endDate != "" {
				requestParams["endDate"] = endDate
			}
			if metricType, ok, err := OptionalParamOK[string](request, "metricType"); ok && err == nil && metricType != "" {
				requestParams["metricType"] = metricType
			}

			// Call API
			resp, err := client.GetProductivityFeatureDrilldown(ctx, requestParams)
			if err != nil {
				return nil, fmt.Errorf("failed to get productivity feature drilldown: %w", err)
			}

			// Marshal the response to JSON
			r, err := json.Marshal(resp)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal productivity feature drilldown: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetProductivityFeatureIndividualDrilldownTool creates a tool for getting productivity feature individual drilldown
func GetProductivityFeatureIndividualDrilldownTool(config *config.Config, client *client.SEIService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_productivity_feature_individual_drilldown",
			mcp.WithDescription("Get productivity feature drilldown for an individual user"),
			mcp.WithString("accountId",
				mcp.Required(),
				mcp.Description("Harness Account ID"),
			),
			mcp.WithString("orgId",
				mcp.Required(),
				mcp.DefaultString("default"),
				mcp.Description("Harness Organization ID"),
			),
			mcp.WithString("projectId",
				mcp.Required(),
				mcp.DefaultString("SEI_Harness_Prod"),
				mcp.Description("Harness Project ID"),
			),
			mcp.WithString("userId",
				mcp.Required(),
				mcp.Description("User ID for individual drilldown"),
			),
			mcp.WithString("startDate",
				mcp.Description("Start date for metrics in YYYY-MM-DD format"),
			),
			mcp.WithString("endDate",
				mcp.Description("End date for metrics in YYYY-MM-DD format"),
			),
			mcp.WithString("metricType",
				mcp.Description("Type of metric to retrieve"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Required params
			accountID, err := RequiredParam[string](request, "accountId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			orgID, err := RequiredParam[string](request, "orgId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			projectID, err := RequiredParam[string](request, "projectId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			userID, err := RequiredParam[string](request, "userId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Build params map for additional parameters
			requestParams := map[string]interface{}{
				"accountId": accountID,
				"orgId":     orgID,
				"projectId": projectID,
				"userId":    userID,
			}

			// Optional params
			if startDate, ok, err := OptionalParamOK[string](request, "startDate"); ok && err == nil && startDate != "" {
				requestParams["startDate"] = startDate
			}
			if endDate, ok, err := OptionalParamOK[string](request, "endDate"); ok && err == nil && endDate != "" {
				requestParams["endDate"] = endDate
			}
			if metricType, ok, err := OptionalParamOK[string](request, "metricType"); ok && err == nil && metricType != "" {
				requestParams["metricType"] = metricType
			}

			// Call API
			resp, err := client.GetProductivityFeatureIndividualDrilldown(ctx, requestParams)
			if err != nil {
				return nil, fmt.Errorf("failed to get productivity feature individual drilldown: %w", err)
			}

			// Marshal the response to JSON
			r, err := json.Marshal(resp)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal productivity feature individual drilldown: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetEfficiencyMttrBreakdownTool creates a tool for getting MTTR breakdown
func GetEfficiencyMttrBreakdownTool(config *config.Config, client *client.SEIService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_efficiency_mttr_breakdown",
			mcp.WithDescription("Get MTTR breakdown for a project"),
			mcp.WithString("accountId",
				mcp.Required(),
				mcp.Description("Harness Account ID"),
			),
			mcp.WithString("orgId",
				mcp.Required(),
				mcp.DefaultString("default"),
				mcp.Description("Harness Organization ID"),
			),
			mcp.WithString("projectId",
				mcp.Required(),
				mcp.DefaultString("SEI_Harness_Prod"),
				mcp.Description("Harness Project ID"),
			),
			mcp.WithString("startDate",
				mcp.Description("Start date for metrics in YYYY-MM-DD format"),
			),
			mcp.WithString("endDate",
				mcp.Description("End date for metrics in YYYY-MM-DD format"),
			),
			mcp.WithString("metricType",
				mcp.Description("Type of metric to retrieve"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Required params
			accountID, err := RequiredParam[string](request, "accountId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			orgID, err := RequiredParam[string](request, "orgId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			projectID, err := RequiredParam[string](request, "projectId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Build params map for additional parameters
			requestParams := map[string]interface{}{
				"accountId": accountID,
				"orgId":     orgID,
				"projectId": projectID,
			}

			// Optional params
			if startDate, ok, err := OptionalParamOK[string](request, "startDate"); ok && err == nil && startDate != "" {
				requestParams["startDate"] = startDate
			}
			if endDate, ok, err := OptionalParamOK[string](request, "endDate"); ok && err == nil && endDate != "" {
				requestParams["endDate"] = endDate
			}
			if metricType, ok, err := OptionalParamOK[string](request, "metricType"); ok && err == nil && metricType != "" {
				requestParams["metricType"] = metricType
			}

			// Call API
			resp, err := client.GetEfficiencyMttrBreakdown(ctx, requestParams)
			if err != nil {
				return nil, fmt.Errorf("failed to get MTTR breakdown: %w", err)
			}

			// Marshal the response to JSON
			r, err := json.Marshal(resp)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal MTTR breakdown: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetEfficiencyLeadTimeTool creates a tool for getting lead time
func GetEfficiencyLeadTimeTool(config *config.Config, client *client.SEIService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_efficiency_lead_time",
			mcp.WithDescription("Get lead time for a project"),
			mcp.WithString("accountId",
				mcp.Required(),
				mcp.Description("Harness Account ID"),
			),
			mcp.WithString("orgId",
				mcp.Required(),
				mcp.DefaultString("default"),
				mcp.Description("Harness Organization ID"),
			),
			mcp.WithString("projectId",
				mcp.Required(),
				mcp.DefaultString("SEI_Harness_Prod"),
				mcp.Description("Harness Project ID"),
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
				mcp.Description("Optional drill-down start date in YYYY-MM-DD format"),
			),
			mcp.WithString("drillDownEndDate",
				mcp.Description("Optional drill-down end date in YYYY-MM-DD format"),
			),
			mcp.WithNumber("page",
				mcp.Description("Optional page number for pagination"),
			),
			mcp.WithNumber("pageSize",
				mcp.Description("Optional page size for pagination"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Required params
			accountID, err := RequiredParam[string](request, "accountId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			orgID, err := RequiredParam[string](request, "orgId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			projectID, err := RequiredParam[string](request, "projectId")
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
				"orgId":       orgID,
				"projectId":   projectID,
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

// GetEfficiencyLeadTimeStagesTool creates a tool for getting lead time stages
func GetEfficiencyLeadTimeStagesTool(config *config.Config, client *client.SEIService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_efficiency_lead_time_stages",
			mcp.WithDescription("Get lead time stages for a project"),
			mcp.WithString("accountId",
				mcp.Required(),
				mcp.Description("Harness Account ID"),
			),
			mcp.WithString("orgId",
				mcp.Required(),
				mcp.DefaultString("default"),
				mcp.Description("Harness Organization ID"),
			),
			mcp.WithString("projectId",
				mcp.Required(),
				mcp.DefaultString("SEI_Harness_Prod"),
				mcp.Description("Harness Project ID"),
			),
			mcp.WithString("startDate",
				mcp.Description("Start date for metrics in YYYY-MM-DD format"),
			),
			mcp.WithString("endDate",
				mcp.Description("End date for metrics in YYYY-MM-DD format"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Required params
			accountID, err := RequiredParam[string](request, "accountId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			orgID, err := RequiredParam[string](request, "orgId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			projectID, err := RequiredParam[string](request, "projectId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Build params map for additional parameters
			requestParams := map[string]interface{}{
				"accountId": accountID,
				"orgId":     orgID,
				"projectId": projectID,
			}

			// Optional params
			if startDate, ok, err := OptionalParamOK[string](request, "startDate"); ok && err == nil && startDate != "" {
				requestParams["startDate"] = startDate
			}
			if endDate, ok, err := OptionalParamOK[string](request, "endDate"); ok && err == nil && endDate != "" {
				requestParams["endDate"] = endDate
			}

			// Call API
			resp, err := client.GetEfficiencyLeadTimeStages(ctx, requestParams)
			if err != nil {
				return nil, fmt.Errorf("failed to get lead time stages: %w", err)
			}

			// Marshal the response to JSON
			r, err := json.Marshal(resp)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal lead time stages: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetEfficiencyLeadTimeDrilldownTool creates a tool for getting lead time drilldown
func GetEfficiencyLeadTimeDrilldownTool(config *config.Config, client *client.SEIService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_efficiency_lead_time_drilldown",
			mcp.WithDescription("Get Lead Time to Change drilldown data with pagination"),
			mcp.WithString("accountId",
				mcp.Required(),
				mcp.Description("Harness Account ID"),
			),
			mcp.WithString("orgId",
				mcp.Required(),
				mcp.DefaultString("default"),
				mcp.Description("Harness Organization ID"),
			),
			mcp.WithString("projectId",
				mcp.Required(),
				mcp.DefaultString("SEI_Harness_Prod"),
				mcp.Description("Harness Project ID"),
			),
			mcp.WithString("startDate",
				mcp.Description("Start date for metrics in YYYY-MM-DD format"),
			),
			mcp.WithString("endDate",
				mcp.Description("End date for metrics in YYYY-MM-DD format"),
			),
			mcp.WithNumber("page",
				mcp.DefaultNumber(0),
				mcp.Description("Page number for pagination - page 0 is the first page"),
			),
			mcp.WithNumber("size",
				mcp.DefaultNumber(5),
				mcp.Description("Number of items per page"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Required params
			accountID, err := RequiredParam[string](request, "accountId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			orgID, err := RequiredParam[string](request, "orgId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			projectID, err := RequiredParam[string](request, "projectId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Build params map for additional parameters
			requestParams := map[string]interface{}{
				"accountId": accountID,
				"orgId":     orgID,
				"projectId": projectID,
			}

			// Optional params
			if startDate, ok, err := OptionalParamOK[string](request, "startDate"); ok && err == nil && startDate != "" {
				requestParams["startDate"] = startDate
			}
			if endDate, ok, err := OptionalParamOK[string](request, "endDate"); ok && err == nil && endDate != "" {
				requestParams["endDate"] = endDate
			}

			// Get page and size parameters
			page, ok, err := OptionalParamOK[float64](request, "page")
			if ok && err == nil {
				requestParams["page"] = page
			} else {
				requestParams["page"] = 0
			}

			size, ok, err := OptionalParamOK[float64](request, "size")
			if ok && err == nil {
				requestParams["size"] = size
			} else {
				requestParams["size"] = 5
			}

			// Call API
			resp, err := client.GetEfficiencyLeadTimeDrilldown(ctx, requestParams)
			if err != nil {
				return nil, fmt.Errorf("failed to get lead time drilldown: %w", err)
			}

			// Marshal the response to JSON
			r, err := json.Marshal(resp)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal lead time drilldown: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetEfficiencyDeploymentFrequencyDrilldownTool creates a tool for getting deployment frequency drilldown
func GetEfficiencyDeploymentFrequencyDrilldownTool(config *config.Config, client *client.SEIService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_efficiency_deployment_frequency_drilldown",
			mcp.WithDescription("Get drill-down data for deployment frequency"),
			mcp.WithString("accountId",
				mcp.Required(),
				mcp.Description("Harness Account ID"),
			),
			mcp.WithString("orgId",
				mcp.Required(),
				mcp.DefaultString("default"),
				mcp.Description("Harness Organization ID"),
			),
			mcp.WithString("projectId",
				mcp.Required(),
				mcp.DefaultString("SEI_Harness_Prod"),
				mcp.Description("Harness Project ID"),
			),
			mcp.WithString("startDate",
				mcp.Description("Start date for metrics in YYYY-MM-DD format"),
			),
			mcp.WithString("endDate",
				mcp.Description("End date for metrics in YYYY-MM-DD format"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Required params
			accountID, err := RequiredParam[string](request, "accountId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			orgID, err := RequiredParam[string](request, "orgId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			projectID, err := RequiredParam[string](request, "projectId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Build params map for additional parameters
			requestParams := map[string]interface{}{
				"accountId": accountID,
				"orgId":     orgID,
				"projectId": projectID,
			}

			// Optional params
			if startDate, ok, err := OptionalParamOK[string](request, "startDate"); ok && err == nil && startDate != "" {
				requestParams["startDate"] = startDate
			}
			if endDate, ok, err := OptionalParamOK[string](request, "endDate"); ok && err == nil && endDate != "" {
				requestParams["endDate"] = endDate
			}

			// Call API
			resp, err := client.GetEfficiencyDeploymentFrequencyDrilldown(ctx, requestParams)
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

// GetEfficiencyChangeFailureRateDrilldownTool creates a tool for getting change failure rate drilldown
func GetEfficiencyChangeFailureRateDrilldownTool(config *config.Config, client *client.SEIService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_efficiency_change_failure_rate_drilldown",
			mcp.WithDescription("Get drill-down data for change failure rate"),
			mcp.WithString("accountId",
				mcp.Required(),
				mcp.Description("Harness Account ID"),
			),
			mcp.WithString("orgId",
				mcp.Required(),
				mcp.DefaultString("default"),
				mcp.Description("Harness Organization ID"),
			),
			mcp.WithString("projectId",
				mcp.Required(),
				mcp.DefaultString("SEI_Harness_Prod"),
				mcp.Description("Harness Project ID"),
			),
			mcp.WithString("startDate",
				mcp.Description("Start date for metrics in YYYY-MM-DD format"),
			),
			mcp.WithString("endDate",
				mcp.Description("End date for metrics in YYYY-MM-DD format"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Required params
			accountID, err := RequiredParam[string](request, "accountId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			orgID, err := RequiredParam[string](request, "orgId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			projectID, err := RequiredParam[string](request, "projectId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Build params map for additional parameters
			requestParams := map[string]interface{}{
				"accountId": accountID,
				"orgId":     orgID,
				"projectId": projectID,
			}

			// Optional params
			if startDate, ok, err := OptionalParamOK[string](request, "startDate"); ok && err == nil && startDate != "" {
				requestParams["startDate"] = startDate
			}
			if endDate, ok, err := OptionalParamOK[string](request, "endDate"); ok && err == nil && endDate != "" {
				requestParams["endDate"] = endDate
			}

			// Call API
			resp, err := client.GetEfficiencyChangeFailureRateDrilldown(ctx, requestParams)
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
