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

// ===== Common Types and Helpers =====

// aiBaseParams holds the common parameters required by most AI Insights tools
type aiBaseParams struct {
	AccountID       string
	TeamRefID       string
	StartDate       string
	EndDate         string
	IntegrationType string
	ProjectID       string
	OrgID           string
}

// extractBaseParams extracts the common required parameters from the request
func extractBaseParams(ctx context.Context, cfg *config.McpServerConfig, request mcp.CallToolRequest) (*aiBaseParams, error) {
	accountID, err := RequiredParam[string](request, "accountId")
	if err != nil {
		return nil, err
	}
	teamRefID, err := RequiredParam[string](request, "teamRefId")
	if err != nil {
		return nil, err
	}
	startDate, err := RequiredParam[string](request, "startDate")
	if err != nil {
		return nil, err
	}
	endDate, err := RequiredParam[string](request, "endDate")
	if err != nil {
		return nil, err
	}
	integrationType, err := RequiredParam[string](request, "integrationType")
	if err != nil {
		return nil, err
	}

	scope, err := common.FetchScope(ctx, cfg, request, true)
	if err != nil {
		return nil, err
	}

	return &aiBaseParams{
		AccountID:       accountID,
		TeamRefID:       teamRefID,
		StartDate:       startDate,
		EndDate:         endDate,
		IntegrationType: integrationType,
		ProjectID:       scope.ProjectID,
		OrgID:           scope.OrgID,
	}, nil
}

// toParamsMap converts base params to a map for API calls
func (p *aiBaseParams) toParamsMap() map[string]interface{} {
	return map[string]interface{}{
		"accountId":       p.AccountID,
		"teamRefId":       p.TeamRefID,
		"startDate":       p.StartDate,
		"endDate":         p.EndDate,
		"integrationType": p.IntegrationType,
		"projectId":       p.ProjectID,
		"orgId":           p.OrgID,
	}
}

// marshalResult marshals the API result to JSON
func marshalResult(result interface{}) (*mcp.CallToolResult, error) {
	r, err := json.Marshal(result)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal response: %w", err)
	}
	return mcp.NewToolResultText(string(r)), nil
}

// withCommonAIToolOptions returns common MCP tool options for AI Insights tools
func withCommonAIToolOptions(cfg *config.McpServerConfig) []mcp.ToolOption {
	return []mcp.ToolOption{
		mcp.WithToolAnnotation(mcp.ToolAnnotation{ReadOnlyHint: utils.ToBoolPtr(true)}),
		common.WithScope(cfg, true),
		mcp.WithString("accountId", mcp.Required(), mcp.Description("Harness Account ID")),
		mcp.WithString("teamRefId", mcp.Required(), mcp.Description("Team reference ID (use sei_get_teams_list to find available teams)")),
		mcp.WithString("startDate", mcp.Required(), mcp.Description("Start date in YYYY-MM-DD format")),
		mcp.WithString("endDate", mcp.Required(), mcp.Description("End date in YYYY-MM-DD format")),
		mcp.WithString("integrationType", mcp.Required(), mcp.Description("AI integration type (cursor, windsurf, or all_assistants for both)"), mcp.Enum("cursor", "windsurf", "all_assistants")),
	}
}

// extractPaginationParams extracts optional pagination parameters and adds them to params map
func extractPaginationParams(request mcp.CallToolRequest, params map[string]interface{}) {
	if typeVal, ok, err := OptionalParamOK[string](request, "type"); ok && err == nil && typeVal != "" {
		params["type"] = typeVal
	}
	if page, ok, err := OptionalParamOK[float64](request, "page"); ok && err == nil {
		params["page"] = int(page)
	}
	if pageSize, ok, err := OptionalParamOK[float64](request, "pageSize"); ok && err == nil {
		params["pageSize"] = int(pageSize)
	}
}

// rawMetricsPaginationOptions returns the common pagination options for raw metrics tools
func rawMetricsPaginationOptions() []mcp.ToolOption {
	return []mcp.ToolOption{
		mcp.WithString("type", mcp.Description("Raw metric type to retrieve (optional)")),
		mcp.WithNumber("page", mcp.Description("Page number for pagination (0-indexed, optional, defaults to 0)")),
		mcp.WithNumber("pageSize", mcp.Description("Number of items per page (optional, defaults to API default)")),
	}
}

// ===== AI Coding Assistant Usage Metrics Tool =====

// GetAIUsageMetricsTool creates a tool for getting AI coding assistant feature metrics
func GetAIUsageMetricsTool(cfg *config.McpServerConfig, aiClient *client.AIInsightsService) (mcp.Tool, server.ToolHandlerFunc) {
	opts := append(withCommonAIToolOptions(cfg),
		mcp.WithDescription("Get AI coding assistant feature metrics with time-series data. Returns data points over time for the selected metric type. See also: sei_get_ai_usage_summary for aggregate stats, sei_get_ai_adoptions for adoption trends."),
		mcp.WithString("granularity", mcp.Required(), mcp.Description("Time granularity for the metrics"), mcp.Enum("DAILY", "WEEKLY", "MONTHLY")),
		mcp.WithString("metricType", mcp.Required(), mcp.Description("Type of metric to retrieve"), mcp.Enum("linesAddedPerContributor", "linesSuggested", "linesAccepted", "acceptanceRatePercentage", "DAILY_ACTIVE_USERS")),
	)

	return mcp.NewTool("sei_get_ai_usage_metrics", opts...),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			base, err := extractBaseParams(ctx, cfg, request)
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

			params := base.toParamsMap()
			params["granularity"] = granularity
			params["metricType"] = metricType

			result, err := aiClient.GetAIUsageMetrics(ctx, params)
			if err != nil {
				return nil, fmt.Errorf("failed to get AI usage metrics: %w", err)
			}
			return marshalResult(result)
		}
}

// ===== AI Coding Assistant Usage Breakdown Tool =====

// GetAIUsageBreakdownTool creates a tool for getting AI coding assistant team breakdown metrics
func GetAIUsageBreakdownTool(cfg *config.McpServerConfig, aiClient *client.AIInsightsService) (mcp.Tool, server.ToolHandlerFunc) {
	opts := append(withCommonAIToolOptions(cfg),
		mcp.WithDescription("Get AI coding assistant usage breakdown by child teams. Returns metrics for each sub-team with team ID and name. See also: sei_get_ai_usage_summary for aggregate stats."),
		mcp.WithString("granularity", mcp.Description("Time granularity for the metrics (optional, defaults to aggregated data if omitted)"), mcp.Enum("DAILY", "WEEKLY", "MONTHLY")),
		mcp.WithString("metricType", mcp.Description("Type of metric to retrieve (optional, returns all metrics if omitted)"), mcp.Enum("linesAddedPerContributor", "linesSuggested", "linesAccepted", "acceptanceRatePercentage", "DAILY_ACTIVE_USERS")),
	)

	return mcp.NewTool("sei_get_ai_usage_breakdown", opts...),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			base, err := extractBaseParams(ctx, cfg, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			params := base.toParamsMap()

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
			return marshalResult(result)
		}
}

// ===== AI Coding Assistant Usage Summary Tool =====

// GetAIUsageSummaryTool creates a tool for getting AI coding assistant usage summary
func GetAIUsageSummaryTool(cfg *config.McpServerConfig, aiClient *client.AIInsightsService) (mcp.Tool, server.ToolHandlerFunc) {
	opts := append(withCommonAIToolOptions(cfg),
		mcp.WithDescription("Get summary statistics for AI coding assistants. Returns total users, acceptance rates, and lines of code for the period. See also: sei_get_ai_usage_metrics for time-series data, sei_get_ai_raw_metrics for per-developer details."),
	)

	return mcp.NewTool("sei_get_ai_usage_summary", opts...),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			base, err := extractBaseParams(ctx, cfg, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			result, err := aiClient.GetAIUsageSummary(ctx, base.toParamsMap())
			if err != nil {
				return nil, fmt.Errorf("failed to get AI usage summary: %w", err)
			}
			return marshalResult(result)
		}
}

// ===== AI Coding Assistant Top Languages Tool =====

// GetAITopLanguagesTool creates a tool for getting top programming languages used with AI assistants
func GetAITopLanguagesTool(cfg *config.McpServerConfig, aiClient *client.AIInsightsService) (mcp.Tool, server.ToolHandlerFunc) {
	opts := append(withCommonAIToolOptions(cfg),
		mcp.WithDescription("Get top programming languages used with AI coding assistants. Returns languages ranked by usage count and percentage. See also: sei_get_ai_usage_summary for overall stats."),
	)

	return mcp.NewTool("sei_get_ai_top_languages", opts...),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			base, err := extractBaseParams(ctx, cfg, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			result, err := aiClient.GetAITopLanguages(ctx, base.toParamsMap())
			if err != nil {
				return nil, fmt.Errorf("failed to get AI top languages: %w", err)
			}
			return marshalResult(result)
		}
}

// ===== AI Coding Assistant Adoption Metrics Tool =====

// GetAIAdoptionsTool creates a tool for getting AI coding assistant adoption metrics
func GetAIAdoptionsTool(cfg *config.McpServerConfig, aiClient *client.AIInsightsService) (mcp.Tool, server.ToolHandlerFunc) {
	opts := append(withCommonAIToolOptions(cfg),
		mcp.WithDescription("Get AI coding assistant adoption metrics showing team adoption rates over time. Returns time-series data of adoption percentages. See also: sei_get_ai_adoptions_summary for period comparison."),
		mcp.WithString("granularity", mcp.Required(), mcp.Description("Time granularity for the metrics"), mcp.Enum("DAILY", "WEEKLY", "MONTHLY")),
	)

	return mcp.NewTool("sei_get_ai_adoptions", opts...),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			base, err := extractBaseParams(ctx, cfg, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			granularity, err := RequiredParam[string](request, "granularity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			params := base.toParamsMap()
			params["granularity"] = granularity

			result, err := aiClient.GetAIAdoptions(ctx, params)
			if err != nil {
				return nil, fmt.Errorf("failed to get AI adoptions: %w", err)
			}
			return marshalResult(result)
		}
}

// ===== AI Coding Assistant Adoption Breakdown Tool =====

// GetAIAdoptionsBreakdownTool creates a tool for getting AI adoption breakdown by teams
func GetAIAdoptionsBreakdownTool(cfg *config.McpServerConfig, aiClient *client.AIInsightsService) (mcp.Tool, server.ToolHandlerFunc) {
	opts := append(withCommonAIToolOptions(cfg),
		mcp.WithDescription("Get AI coding assistant adoption breakdown by direct child teams. Returns aggregated adoption values across the date range per team. See also: sei_get_ai_adoptions for time-series data."),
	)

	return mcp.NewTool("sei_get_ai_adoptions_breakdown", opts...),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			base, err := extractBaseParams(ctx, cfg, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			result, err := aiClient.GetAIAdoptionsBreakdown(ctx, base.toParamsMap())
			if err != nil {
				return nil, fmt.Errorf("failed to get AI adoptions breakdown: %w", err)
			}
			return marshalResult(result)
		}
}

// ===== AI Coding Assistant Adoption Summary Tool =====

// GetAIAdoptionsSummaryTool creates a tool for getting AI adoption summary with period comparison
func GetAIAdoptionsSummaryTool(cfg *config.McpServerConfig, aiClient *client.AIInsightsService) (mcp.Tool, server.ToolHandlerFunc) {
	opts := append(withCommonAIToolOptions(cfg),
		mcp.WithDescription("Get AI coding assistant adoption summary with current vs previous period comparison. Useful for trend analysis. See also: sei_get_ai_adoptions for time-series data."),
	)

	return mcp.NewTool("sei_get_ai_adoptions_summary", opts...),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			base, err := extractBaseParams(ctx, cfg, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			result, err := aiClient.GetAIAdoptionsSummary(ctx, base.toParamsMap())
			if err != nil {
				return nil, fmt.Errorf("failed to get AI adoptions summary: %w", err)
			}
			return marshalResult(result)
		}
}

// ===== AI Coding Assistant Raw Metrics Tool =====

// GetAIRawMetricsTool creates a tool for getting paginated raw AI metrics with detailed per-developer data
func GetAIRawMetricsTool(cfg *config.McpServerConfig, aiClient *client.AIInsightsService) (mcp.Tool, server.ToolHandlerFunc) {
	opts := append(withCommonAIToolOptions(cfg),
		mcp.WithDescription("Get paginated raw metrics for AI coding assistants with detailed per-developer data. Returns individual developer usage statistics including lines suggested, accepted, and acceptance rates. See also: sei_get_ai_usage_summary for aggregate stats."),
	)
	opts = append(opts, rawMetricsPaginationOptions()...)

	return mcp.NewTool("sei_get_ai_raw_metrics", opts...),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			base, err := extractBaseParams(ctx, cfg, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			params := base.toParamsMap()
			extractPaginationParams(request, params)

			// Uses v2 API internally for enhanced filtering
			result, err := aiClient.GetAIRawMetricsV2(ctx, params)
			if err != nil {
				return nil, fmt.Errorf("failed to get AI raw metrics: %w", err)
			}
			return marshalResult(result)
		}
}

// ===== AI Coding Assistant Impact Tool =====

// GetAIImpactTool creates a tool for getting AI impact metrics (PR velocity or rework comparison)
func GetAIImpactTool(cfg *config.McpServerConfig, aiClient *client.AIInsightsService) (mcp.Tool, server.ToolHandlerFunc) {
	opts := append(withCommonAIToolOptions(cfg),
		mcp.WithDescription("Get AI impact metrics comparing AI-assisted vs non-AI-assisted code. Use impactType 'pr_velocity' for PR cycle time comparison or 'rework' for code quality/rework rate comparison. See also: sei_get_ai_usage_summary for usage stats."),
		mcp.WithString("impactType", mcp.Required(), mcp.Description("Type of impact metric: 'pr_velocity' for PR cycle time, 'rework' for code quality"), mcp.Enum("pr_velocity", "rework")),
		mcp.WithString("granularity", mcp.Required(), mcp.Description("Time granularity for the metrics"), mcp.Enum("DAILY", "WEEKLY", "MONTHLY")),
	)

	return mcp.NewTool("sei_get_ai_impact", opts...),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			base, err := extractBaseParams(ctx, cfg, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			impactType, err := RequiredParam[string](request, "impactType")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			granularity, err := RequiredParam[string](request, "granularity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			params := base.toParamsMap()
			params["granularity"] = granularity

			var result interface{}
			switch impactType {
			case "pr_velocity":
				result, err = aiClient.GetAIPRVelocitySummary(ctx, params)
				if err != nil {
					return nil, fmt.Errorf("failed to get AI PR velocity impact: %w", err)
				}
			case "rework":
				result, err = aiClient.GetAIReworkSummary(ctx, params)
				if err != nil {
					return nil, fmt.Errorf("failed to get AI rework impact: %w", err)
				}
			default:
				return mcp.NewToolResultError(fmt.Sprintf("invalid impactType: %s, must be 'pr_velocity' or 'rework'", impactType)), nil
			}

			return marshalResult(result)
		}
}
