package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/common"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// GetProductivityFeatureMetricsTool creates a tool for getting productivity feature metrics
func GetProductivityFeatureMetricsTool(config *config.Config, client *client.SEIService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_productivity_feature_metrics",
			mcp.WithDescription("Get productivity metrics for a collection"),
			common.WithScope(config, true),
			mcp.WithString("accountId",
				mcp.Required(),
				mcp.Description("Harness Account ID"),
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
			mcp.WithString("teamId",
				mcp.Description("Single team ID to filter by"),
			),
			mcp.WithArray("teamIds",
				mcp.Description("List of team IDs to filter by"),
			),
			mcp.WithArray("teamRefIds",
				mcp.Description("List of team reference IDs to filter by"),
			),
			mcp.WithString("stackBy",
				mcp.Description("Dimension to stack the metrics by (e.g., PR_SIZE, WORK_TYPE)"),
			),
			mcp.WithString("sortBy",
				mcp.Description("Field to sort results by"),
			),
			mcp.WithString("sortByCriteria",
				mcp.Description("Criteria for sorting (ASC, DESC)"),
			),
			mcp.WithNumber("page",
				mcp.Description("Page number for pagination"),
			),
			mcp.WithNumber("page_size",
				mcp.Description("Number of items per page"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Required params
			accountID, err := RequiredParam[string](request, "accountId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			scope, err := common.FetchScope(config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			startDate, err := RequiredParam[string](request, "startDate")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			endDate, err := RequiredParam[string](request, "endDate")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			featureType, err := RequiredParam[string](request, "featureType")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Build params map for additional parameters
			requestParams := map[string]interface{}{
				"accountId":   accountID,
				"orgId":       scope.OrgID,
				"projectId":   scope.ProjectID,
				"startDate":   startDate,
				"endDate":     endDate,
				"featureType": featureType,
			}

			// Optional params
			if granularity, ok, err := OptionalParamOK[string](request, "granularity"); ok && err == nil && granularity != "" {
				requestParams["granularity"] = granularity
			}
			if developerIds, ok, err := OptionalParamOK[[]interface{}](request, "developerIds"); ok && err == nil {
				requestParams["developerIds"] = developerIds
			}
			if developerRefIds, ok, err := OptionalParamOK[[]interface{}](request, "developerRefIds"); ok && err == nil {
				requestParams["developerRefIds"] = developerRefIds
			}
			if teamId, ok, err := OptionalParamOK[string](request, "teamId"); ok && err == nil && teamId != "" {
				requestParams["teamId"] = teamId
			}
			if teamIds, ok, err := OptionalParamOK[[]interface{}](request, "teamIds"); ok && err == nil {
				requestParams["teamIds"] = teamIds
			}
			if teamRefIds, ok, err := OptionalParamOK[[]interface{}](request, "teamRefIds"); ok && err == nil {
				requestParams["teamRefIds"] = teamRefIds
			}
			if stackBy, ok, err := OptionalParamOK[string](request, "stackBy"); ok && err == nil && stackBy != "" {
				requestParams["stackBy"] = stackBy
			}
			if sortBy, ok, err := OptionalParamOK[string](request, "sortBy"); ok && err == nil && sortBy != "" {
				requestParams["sortBy"] = sortBy
			}
			if sortByCriteria, ok, err := OptionalParamOK[string](request, "sortByCriteria"); ok && err == nil && sortByCriteria != "" {
				requestParams["sortByCriteria"] = sortByCriteria
			}
			if page, ok, err := OptionalParamOK[float64](request, "page"); ok && err == nil {
				requestParams["page"] = int(page)
			}
			if pageSize, ok, err := OptionalParamOK[float64](request, "page_size"); ok && err == nil {
				requestParams["page_size"] = int(pageSize)
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
