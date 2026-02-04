package tools

import (
	"context"
	"encoding/json"
	"fmt"

	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/client"
	"github.com/harness/mcp-server/common/pkg/common"
	"github.com/harness/mcp-server/common/pkg/utils"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// ===== AI Coding Assistant Usage Metrics Tool =====

// GetAIUsageMetricsTool creates a tool for getting AI coding assistant feature metrics
func GetAIUsageMetricsTool(config *config.McpServerConfig, aiClient *client.AIInsightsService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_get_ai_usage_metrics",
			mcp.WithDescription("Get AI coding assistant feature metrics with time-series data. Returns data points over time for the selected metric type. See also: sei_get_ai_usage_summary for aggregate stats, sei_get_ai_adoptions for adoption trends."),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint: utils.ToBoolPtr(true),
			}),
			common.WithScope(config, true),
			mcp.WithString("accountId",
				mcp.Required(),
				mcp.Description("Harness Account ID"),
			),
			mcp.WithString("teamRefId",
				mcp.Required(),
				mcp.Description("Team reference ID (use sei_get_teams_list to find available teams)"),
			),
			mcp.WithString("startDate",
				mcp.Required(),
				mcp.Description("Start date in YYYY-MM-DD format"),
			),
			mcp.WithString("endDate",
				mcp.Required(),
				mcp.Description("End date in YYYY-MM-DD format"),
			),
			mcp.WithString("granularity",
				mcp.Required(),
				mcp.Description("Time granularity for the metrics"),
				mcp.Enum("DAILY", "WEEKLY", "MONTHLY"),
			),
			mcp.WithString("metricType",
				mcp.Required(),
				mcp.Description("Type of metric to retrieve"),
				mcp.Enum("linesAddedPerContributor", "linesSuggested", "linesAccepted", "acceptanceRatePercentage", "DAILY_ACTIVE_USERS"),
			),
			mcp.WithString("integrationType",
				mcp.Required(),
				mcp.Description("AI integration type (cursor, windsurf)"),
				mcp.Enum("cursor", "windsurf"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accountId, err := RequiredParam[string](request, "accountId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			teamRefId, err := RequiredParam[string](request, "teamRefId")
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
			granularity, err := RequiredParam[string](request, "granularity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			metricType, err := RequiredParam[string](request, "metricType")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := common.FetchScope(ctx, config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			integrationType, err := RequiredParam[string](request, "integrationType")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			params := map[string]interface{}{
				"accountId":       accountId,
				"teamRefId":       teamRefId,
				"startDate":       startDate,
				"endDate":         endDate,
				"granularity":     granularity,
				"metricType":      metricType,
				"integrationType": integrationType,
				"projectId":       scope.ProjectID,
				"orgId":           scope.OrgID,
			}

			result, err := aiClient.GetAIUsageMetrics(ctx, params)
			if err != nil {
				return nil, fmt.Errorf("failed to get AI usage metrics: %w", err)
			}

			r, err := json.Marshal(result)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// ===== AI Coding Assistant Usage Breakdown Tool =====

// GetAIUsageBreakdownTool creates a tool for getting AI coding assistant team breakdown metrics
func GetAIUsageBreakdownTool(config *config.McpServerConfig, aiClient *client.AIInsightsService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_get_ai_usage_breakdown",
			mcp.WithDescription("Get AI coding assistant usage breakdown by child teams. Returns metrics for each sub-team with team ID and name. See also: sei_get_ai_usage_summary for aggregate stats."),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint: utils.ToBoolPtr(true),
			}),
			common.WithScope(config, true),
			mcp.WithString("accountId",
				mcp.Required(),
				mcp.Description("Harness Account ID"),
			),
			mcp.WithString("teamRefId",
				mcp.Required(),
				mcp.Description("Team reference ID (use sei_get_teams_list to find available teams)"),
			),
			mcp.WithString("startDate",
				mcp.Required(),
				mcp.Description("Start date in YYYY-MM-DD format"),
			),
			mcp.WithString("endDate",
				mcp.Required(),
				mcp.Description("End date in YYYY-MM-DD format"),
			),
			mcp.WithString("granularity",
				mcp.Description("Time granularity for the metrics (optional, defaults to aggregated data if omitted)"),
				mcp.Enum("DAILY", "WEEKLY", "MONTHLY"),
			),
			mcp.WithString("metricType",
				mcp.Description("Type of metric to retrieve (optional, returns all metrics if omitted)"),
				mcp.Enum("linesAddedPerContributor", "linesSuggested", "linesAccepted", "acceptanceRatePercentage", "DAILY_ACTIVE_USERS"),
			),
			mcp.WithString("integrationType",
				mcp.Required(),
				mcp.Description("AI integration type (cursor, windsurf)"),
				mcp.Enum("cursor", "windsurf"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accountId, err := RequiredParam[string](request, "accountId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			teamRefId, err := RequiredParam[string](request, "teamRefId")
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
			integrationType, err := RequiredParam[string](request, "integrationType")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := common.FetchScope(ctx, config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			params := map[string]interface{}{
				"accountId":       accountId,
				"teamRefId":       teamRefId,
				"startDate":       startDate,
				"endDate":         endDate,
				"integrationType": integrationType,
				"projectId":       scope.ProjectID,
				"orgId":           scope.OrgID,
			}

			if granularity, ok, err := OptionalParamOK[string](request, "granularity"); ok && err == nil && granularity != "" {
				params["granularity"] = granularity
			}
			if metricType, ok, err := OptionalParamOK[string](request, "metricType"); ok && err == nil && metricType != "" {
				params["metricType"] = metricType
			}

			result, err := aiClient.GetAIUsageBreakdown(ctx, params)
			if err != nil {
				return nil, fmt.Errorf("failed to get AI usage breakdown: %w", err)
			}

			r, err := json.Marshal(result)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// ===== AI Coding Assistant Usage Summary Tool =====

// GetAIUsageSummaryTool creates a tool for getting AI coding assistant usage summary
func GetAIUsageSummaryTool(config *config.McpServerConfig, aiClient *client.AIInsightsService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_get_ai_usage_summary",
			mcp.WithDescription("Get summary statistics for AI coding assistants. Returns total users, acceptance rates, and lines of code for the period. See also: sei_get_ai_usage_metrics for time-series data, sei_get_ai_raw_metrics_v2 for per-developer details."),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint: utils.ToBoolPtr(true),
			}),
			common.WithScope(config, true),
			mcp.WithString("accountId",
				mcp.Required(),
				mcp.Description("Harness Account ID"),
			),
			mcp.WithString("teamRefId",
				mcp.Required(),
				mcp.Description("Team reference ID (use sei_get_teams_list to find available teams)"),
			),
			mcp.WithString("startDate",
				mcp.Required(),
				mcp.Description("Start date in YYYY-MM-DD format"),
			),
			mcp.WithString("endDate",
				mcp.Required(),
				mcp.Description("End date in YYYY-MM-DD format"),
			),
			mcp.WithString("integrationType",
				mcp.Required(),
				mcp.Description("AI integration type (cursor, windsurf)"),
				mcp.Enum("cursor", "windsurf"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accountId, err := RequiredParam[string](request, "accountId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			teamRefId, err := RequiredParam[string](request, "teamRefId")
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
			integrationType, err := RequiredParam[string](request, "integrationType")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := common.FetchScope(ctx, config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			params := map[string]interface{}{
				"accountId":       accountId,
				"teamRefId":       teamRefId,
				"startDate":       startDate,
				"endDate":         endDate,
				"integrationType": integrationType,
				"projectId":       scope.ProjectID,
				"orgId":           scope.OrgID,
			}

			result, err := aiClient.GetAIUsageSummary(ctx, params)
			if err != nil {
				return nil, fmt.Errorf("failed to get AI usage summary: %w", err)
			}

			r, err := json.Marshal(result)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// ===== AI Coding Assistant Top Languages Tool =====

// GetAITopLanguagesTool creates a tool for getting top programming languages used with AI assistants
func GetAITopLanguagesTool(config *config.McpServerConfig, aiClient *client.AIInsightsService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_get_ai_top_languages",
			mcp.WithDescription("Get top programming languages used with AI coding assistants. Returns languages ranked by usage count and percentage. See also: sei_get_ai_usage_summary for overall stats."),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint: utils.ToBoolPtr(true),
			}),
			common.WithScope(config, true),
			mcp.WithString("accountId",
				mcp.Required(),
				mcp.Description("Harness Account ID"),
			),
			mcp.WithString("teamRefId",
				mcp.Required(),
				mcp.Description("Team reference ID (use sei_get_teams_list to find available teams)"),
			),
			mcp.WithString("startDate",
				mcp.Required(),
				mcp.Description("Start date in YYYY-MM-DD format"),
			),
			mcp.WithString("endDate",
				mcp.Required(),
				mcp.Description("End date in YYYY-MM-DD format"),
			),
			mcp.WithString("integrationType",
				mcp.Required(),
				mcp.Description("AI integration type (cursor, windsurf)"),
				mcp.Enum("cursor", "windsurf"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accountId, err := RequiredParam[string](request, "accountId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			teamRefId, err := RequiredParam[string](request, "teamRefId")
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
			integrationType, err := RequiredParam[string](request, "integrationType")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := common.FetchScope(ctx, config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			params := map[string]interface{}{
				"accountId":       accountId,
				"teamRefId":       teamRefId,
				"startDate":       startDate,
				"endDate":         endDate,
				"integrationType": integrationType,
				"projectId":       scope.ProjectID,
				"orgId":           scope.OrgID,
			}

			result, err := aiClient.GetAITopLanguages(ctx, params)
			if err != nil {
				return nil, fmt.Errorf("failed to get AI top languages: %w", err)
			}

			r, err := json.Marshal(result)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// ===== AI Adoption Metrics Tool =====

// GetAIAdoptionsTool creates a tool for getting AI coding assistant adoption metrics
func GetAIAdoptionsTool(config *config.McpServerConfig, aiClient *client.AIInsightsService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_get_ai_adoptions",
			mcp.WithDescription("Get AI coding assistant adoption metrics over time. Returns active/inactive/unassigned user counts per period. See also: sei_get_ai_adoptions_summary for period comparison."),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint: utils.ToBoolPtr(true),
			}),
			common.WithScope(config, true),
			mcp.WithString("accountId",
				mcp.Required(),
				mcp.Description("Harness Account ID"),
			),
			mcp.WithString("teamRefId",
				mcp.Required(),
				mcp.Description("Team reference ID (use sei_get_teams_list to find available teams)"),
			),
			mcp.WithString("startDate",
				mcp.Required(),
				mcp.Description("Start date in YYYY-MM-DD format"),
			),
			mcp.WithString("endDate",
				mcp.Required(),
				mcp.Description("End date in YYYY-MM-DD format"),
			),
			mcp.WithString("granularity",
				mcp.Required(),
				mcp.Description("Time granularity for the metrics"),
				mcp.Enum("DAILY", "WEEKLY", "MONTHLY"),
			),
			mcp.WithString("integrationType",
				mcp.Required(),
				mcp.Description("AI integration type (cursor, windsurf)"),
				mcp.Enum("cursor", "windsurf"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accountId, err := RequiredParam[string](request, "accountId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			teamRefId, err := RequiredParam[string](request, "teamRefId")
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
			granularity, err := RequiredParam[string](request, "granularity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			integrationType, err := RequiredParam[string](request, "integrationType")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := common.FetchScope(ctx, config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			params := map[string]interface{}{
				"accountId":       accountId,
				"teamRefId":       teamRefId,
				"startDate":       startDate,
				"endDate":         endDate,
				"granularity":     granularity,
				"integrationType": integrationType,
				"projectId":       scope.ProjectID,
				"orgId":           scope.OrgID,
			}

			result, err := aiClient.GetAIAdoptions(ctx, params)
			if err != nil {
				return nil, fmt.Errorf("failed to get AI adoptions: %w", err)
			}

			r, err := json.Marshal(result)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// ===== AI Adoption Breakdown Tool =====

// GetAIAdoptionsBreakdownTool creates a tool for getting AI adoption breakdown by child teams
func GetAIAdoptionsBreakdownTool(config *config.McpServerConfig, aiClient *client.AIInsightsService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_get_ai_adoptions_breakdown",
			mcp.WithDescription("Get AI coding assistant adoption breakdown by child teams. Returns aggregated adoption metrics for each sub-team. See also: sei_get_ai_adoptions for time-series data."),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint: utils.ToBoolPtr(true),
			}),
			common.WithScope(config, true),
			mcp.WithString("accountId",
				mcp.Required(),
				mcp.Description("Harness Account ID"),
			),
			mcp.WithString("teamRefId",
				mcp.Required(),
				mcp.Description("Team reference ID (use sei_get_teams_list to find available teams)"),
			),
			mcp.WithString("startDate",
				mcp.Required(),
				mcp.Description("Start date in YYYY-MM-DD format"),
			),
			mcp.WithString("endDate",
				mcp.Required(),
				mcp.Description("End date in YYYY-MM-DD format"),
			),
			mcp.WithString("integrationType",
				mcp.Required(),
				mcp.Description("AI integration type (cursor, windsurf)"),
				mcp.Enum("cursor", "windsurf"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accountId, err := RequiredParam[string](request, "accountId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			teamRefId, err := RequiredParam[string](request, "teamRefId")
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
			integrationType, err := RequiredParam[string](request, "integrationType")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := common.FetchScope(ctx, config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			params := map[string]interface{}{
				"accountId":       accountId,
				"teamRefId":       teamRefId,
				"startDate":       startDate,
				"endDate":         endDate,
				"integrationType": integrationType,
				"projectId":       scope.ProjectID,
				"orgId":           scope.OrgID,
			}

			result, err := aiClient.GetAIAdoptionsBreakdown(ctx, params)
			if err != nil {
				return nil, fmt.Errorf("failed to get AI adoptions breakdown: %w", err)
			}

			r, err := json.Marshal(result)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// ===== AI Adoption Summary Tool =====

// GetAIAdoptionsSummaryTool creates a tool for getting AI adoption summary with period comparison
func GetAIAdoptionsSummaryTool(config *config.McpServerConfig, aiClient *client.AIInsightsService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_get_ai_adoptions_summary",
			mcp.WithDescription("Get AI coding assistant adoption summary comparing current vs previous period. Returns growth metrics and adoption rate changes. See also: sei_get_ai_adoptions for time-series data."),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint: utils.ToBoolPtr(true),
			}),
			common.WithScope(config, true),
			mcp.WithString("accountId",
				mcp.Required(),
				mcp.Description("Harness Account ID"),
			),
			mcp.WithString("teamRefId",
				mcp.Required(),
				mcp.Description("Team reference ID (use sei_get_teams_list to find available teams)"),
			),
			mcp.WithString("startDate",
				mcp.Required(),
				mcp.Description("Start date in YYYY-MM-DD format"),
			),
			mcp.WithString("endDate",
				mcp.Required(),
				mcp.Description("End date in YYYY-MM-DD format"),
			),
			mcp.WithString("integrationType",
				mcp.Required(),
				mcp.Description("AI integration type (cursor, windsurf)"),
				mcp.Enum("cursor", "windsurf"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accountId, err := RequiredParam[string](request, "accountId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			teamRefId, err := RequiredParam[string](request, "teamRefId")
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
			integrationType, err := RequiredParam[string](request, "integrationType")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := common.FetchScope(ctx, config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			params := map[string]interface{}{
				"accountId":       accountId,
				"teamRefId":       teamRefId,
				"startDate":       startDate,
				"endDate":         endDate,
				"integrationType": integrationType,
				"projectId":       scope.ProjectID,
				"orgId":           scope.OrgID,
			}

			result, err := aiClient.GetAIAdoptionsSummary(ctx, params)
			if err != nil {
				return nil, fmt.Errorf("failed to get AI adoptions summary: %w", err)
			}

			r, err := json.Marshal(result)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// ===== AI Raw Metrics Tool =====

// GetAIRawMetricsTool creates a tool for getting raw metrics for AI coding assistants
func GetAIRawMetricsTool(config *config.McpServerConfig, aiClient *client.AIInsightsService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_get_ai_raw_metrics",
			mcp.WithDescription("Get paginated per-developer AI coding assistant metrics. Returns detailed data including acceptance rate, lines accepted, and coding days. See also: sei_get_ai_raw_metrics_v2 for enhanced filtering."),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint: utils.ToBoolPtr(true),
			}),
			common.WithScope(config, true),
			mcp.WithString("accountId",
				mcp.Required(),
				mcp.Description("Harness Account ID"),
			),
			mcp.WithString("teamRefId",
				mcp.Required(),
				mcp.Description("Team reference ID (use sei_get_teams_list to find available teams)"),
			),
			mcp.WithString("startDate",
				mcp.Required(),
				mcp.Description("Start date in YYYY-MM-DD format"),
			),
			mcp.WithString("endDate",
				mcp.Required(),
				mcp.Description("End date in YYYY-MM-DD format"),
			),
			mcp.WithString("integrationType",
				mcp.Required(),
				mcp.Description("AI integration type (cursor, windsurf)"),
				mcp.Enum("cursor", "windsurf"),
			),
			mcp.WithString("type",
				mcp.Description("Raw metric type to retrieve (optional, returns all types if omitted)"),
			),
			mcp.WithNumber("page",
				mcp.Description("Page number for pagination, 0-indexed (optional, defaults to 0)"),
			),
			mcp.WithNumber("pageSize",
				mcp.Description("Number of items per page (optional, defaults to 10)"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accountId, err := RequiredParam[string](request, "accountId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			teamRefId, err := RequiredParam[string](request, "teamRefId")
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
			integrationType, err := RequiredParam[string](request, "integrationType")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := common.FetchScope(ctx, config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			params := map[string]interface{}{
				"accountId":       accountId,
				"teamRefId":       teamRefId,
				"startDate":       startDate,
				"endDate":         endDate,
				"integrationType": integrationType,
				"projectId":       scope.ProjectID,
				"orgId":           scope.OrgID,
			}

			if rawMetricType, ok, err := OptionalParamOK[string](request, "type"); ok && err == nil && rawMetricType != "" {
				params["type"] = rawMetricType
			}
			if page, ok, err := OptionalParamOK[float64](request, "page"); ok && err == nil {
				params["page"] = int(page)
			}
			if pageSize, ok, err := OptionalParamOK[float64](request, "pageSize"); ok && err == nil {
				params["pageSize"] = int(pageSize)
			}

			result, err := aiClient.GetAIRawMetrics(ctx, params)
			if err != nil {
				return nil, fmt.Errorf("failed to get AI raw metrics: %w", err)
			}

			r, err := json.Marshal(result)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// ===== AI Raw Metrics V2 Tool =====

// GetAIRawMetricsV2Tool creates a tool for getting raw metrics v2 for AI coding assistants
func GetAIRawMetricsV2Tool(config *config.McpServerConfig, aiClient *client.AIInsightsService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_get_ai_raw_metrics_v2",
			mcp.WithDescription("Get paginated per-developer AI metrics (v2) with enhanced filtering. Returns acceptance rate, lines accepted, coding days, and PR metrics per developer. See also: sei_get_ai_raw_metrics for the v1 endpoint."),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint: utils.ToBoolPtr(true),
			}),
			common.WithScope(config, true),
			mcp.WithString("accountId",
				mcp.Required(),
				mcp.Description("Harness Account ID"),
			),
			mcp.WithString("teamRefId",
				mcp.Required(),
				mcp.Description("Team reference ID (use sei_get_teams_list to find available teams)"),
			),
			mcp.WithString("startDate",
				mcp.Required(),
				mcp.Description("Start date in YYYY-MM-DD format"),
			),
			mcp.WithString("endDate",
				mcp.Required(),
				mcp.Description("End date in YYYY-MM-DD format"),
			),
			mcp.WithString("integrationType",
				mcp.Required(),
				mcp.Description("AI integration type (cursor, windsurf)"),
				mcp.Enum("cursor", "windsurf"),
			),
			mcp.WithString("type",
				mcp.Description("Raw metric type to retrieve (optional, returns all types if omitted)"),
			),
			mcp.WithNumber("page",
				mcp.Description("Page number for pagination, 0-indexed (optional, defaults to 0)"),
			),
			mcp.WithNumber("pageSize",
				mcp.Description("Number of items per page (optional, defaults to 10)"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accountId, err := RequiredParam[string](request, "accountId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			teamRefId, err := RequiredParam[string](request, "teamRefId")
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
			integrationType, err := RequiredParam[string](request, "integrationType")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := common.FetchScope(ctx, config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			params := map[string]interface{}{
				"accountId":       accountId,
				"teamRefId":       teamRefId,
				"startDate":       startDate,
				"endDate":         endDate,
				"integrationType": integrationType,
				"projectId":       scope.ProjectID,
				"orgId":           scope.OrgID,
			}

			if rawMetricType, ok, err := OptionalParamOK[string](request, "type"); ok && err == nil && rawMetricType != "" {
				params["type"] = rawMetricType
			}
			if page, ok, err := OptionalParamOK[float64](request, "page"); ok && err == nil {
				params["page"] = int(page)
			}
			if pageSize, ok, err := OptionalParamOK[float64](request, "pageSize"); ok && err == nil {
				params["pageSize"] = int(pageSize)
			}

			result, err := aiClient.GetAIRawMetricsV2(ctx, params)
			if err != nil {
				return nil, fmt.Errorf("failed to get AI raw metrics v2: %w", err)
			}

			r, err := json.Marshal(result)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// ===== AI PR Velocity Summary Tool =====

// GetAIPRVelocitySummaryTool creates a tool for getting PR velocity summary for AI coding assistants
func GetAIPRVelocitySummaryTool(config *config.McpServerConfig, aiClient *client.AIInsightsService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_get_ai_pr_velocity_summary",
			mcp.WithDescription("Get PR velocity summary comparing AI-assisted vs non-AI-assisted pull requests. Returns cycle time and throughput comparisons. See also: sei_get_ai_rework_summary for code quality comparison."),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint: utils.ToBoolPtr(true),
			}),
			common.WithScope(config, true),
			mcp.WithString("accountId",
				mcp.Required(),
				mcp.Description("Harness Account ID"),
			),
			mcp.WithString("teamRefId",
				mcp.Required(),
				mcp.Description("Team reference ID (use sei_get_teams_list to find available teams)"),
			),
			mcp.WithString("startDate",
				mcp.Required(),
				mcp.Description("Start date in YYYY-MM-DD format"),
			),
			mcp.WithString("endDate",
				mcp.Required(),
				mcp.Description("End date in YYYY-MM-DD format"),
			),
			mcp.WithString("integrationType",
				mcp.Required(),
				mcp.Description("AI integration type (cursor, windsurf)"),
				mcp.Enum("cursor", "windsurf"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accountId, err := RequiredParam[string](request, "accountId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			teamRefId, err := RequiredParam[string](request, "teamRefId")
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
			integrationType, err := RequiredParam[string](request, "integrationType")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := common.FetchScope(ctx, config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			params := map[string]interface{}{
				"accountId":       accountId,
				"teamRefId":       teamRefId,
				"startDate":       startDate,
				"endDate":         endDate,
				"integrationType": integrationType,
				"projectId":       scope.ProjectID,
				"orgId":           scope.OrgID,
			}

			result, err := aiClient.GetAIPRVelocitySummary(ctx, params)
			if err != nil {
				return nil, fmt.Errorf("failed to get AI PR velocity summary: %w", err)
			}

			r, err := json.Marshal(result)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// ===== AI Rework Summary Tool =====

// GetAIReworkSummaryTool creates a tool for getting rework summary for AI coding assistants
func GetAIReworkSummaryTool(config *config.McpServerConfig, aiClient *client.AIInsightsService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_get_ai_rework_summary",
			mcp.WithDescription("Get rework summary comparing AI-assisted vs non-AI-assisted code changes. Returns rework rates and quality metrics comparison. See also: sei_get_ai_pr_velocity_summary for PR velocity comparison."),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint: utils.ToBoolPtr(true),
			}),
			common.WithScope(config, true),
			mcp.WithString("accountId",
				mcp.Required(),
				mcp.Description("Harness Account ID"),
			),
			mcp.WithString("teamRefId",
				mcp.Required(),
				mcp.Description("Team reference ID (use sei_get_teams_list to find available teams)"),
			),
			mcp.WithString("startDate",
				mcp.Required(),
				mcp.Description("Start date in YYYY-MM-DD format"),
			),
			mcp.WithString("endDate",
				mcp.Required(),
				mcp.Description("End date in YYYY-MM-DD format"),
			),
			mcp.WithString("integrationType",
				mcp.Required(),
				mcp.Description("AI integration type (cursor, windsurf)"),
				mcp.Enum("cursor", "windsurf"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accountId, err := RequiredParam[string](request, "accountId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			teamRefId, err := RequiredParam[string](request, "teamRefId")
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
			integrationType, err := RequiredParam[string](request, "integrationType")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := common.FetchScope(ctx, config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			params := map[string]interface{}{
				"accountId":       accountId,
				"teamRefId":       teamRefId,
				"startDate":       startDate,
				"endDate":         endDate,
				"integrationType": integrationType,
				"projectId":       scope.ProjectID,
				"orgId":           scope.OrgID,
			}

			result, err := aiClient.GetAIReworkSummary(ctx, params)
			if err != nil {
				return nil, fmt.Errorf("failed to get AI rework summary: %w", err)
			}

			r, err := json.Marshal(result)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}
