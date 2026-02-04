package client

import (
	"context"
	"fmt"
	"log/slog"
	"strconv"
)

// AIInsightsService handles communication with the SEI AI Insights API (sei-panorama-api)
type AIInsightsService struct {
	Client  *Client
	BaseURL string
	Secret  string
}

// NewAIInsightsService creates a new AIInsightsService with the given client and baseURL
func NewAIInsightsService(client *Client, baseURL, secret string) *AIInsightsService {
	return &AIInsightsService{
		Client:  client,
		BaseURL: baseURL,
		Secret:  secret,
	}
}

// makePostRequest makes a POST request with JSON body and headers
func (s *AIInsightsService) makePostRequest(ctx context.Context, path string, body interface{}, queryParams map[string]string, additionalHeaders map[string]string) (interface{}, error) {
	var response interface{}
	headers := map[string]string{
		"Content-Type": "application/json",
	}

	// Add authentication header if secret is provided
	if s.Secret != "" {
		headers["Authorization"] = "ApiKey " + s.Secret
	}

	// Add any additional headers
	for key, value := range additionalHeaders {
		headers[key] = value
	}

	err := s.Client.Post(ctx, path, queryParams, body, headers, &response)
	if err != nil {
		slog.ErrorContext(ctx, "AI Insights - Post Request failed", "error", err)
		return nil, fmt.Errorf("POST request failed: %w", err)
	}

	return response, nil
}

// buildQueryParams builds common query parameters for AI Insights API
func buildQueryParams(params map[string]interface{}) map[string]string {
	queryParams := map[string]string{}
	if projectId, ok := params["projectId"]; ok {
		if projectStr, ok := projectId.(string); ok {
			queryParams["projectIdentifier"] = projectStr
		}
	}
	if orgId, ok := params["orgId"]; ok {
		if orgStr, ok := orgId.(string); ok {
			queryParams["orgIdentifier"] = orgStr
		}
	}
	return queryParams
}

// buildAccountHeader builds the harness-account header
func buildAccountHeader(params map[string]interface{}) map[string]string {
	headers := map[string]string{}
	if accountId, ok := params["accountId"]; ok {
		if accountStr, ok := accountId.(string); ok {
			headers["harness-account"] = accountStr
		}
	}
	return headers
}

// parseTeamRefId converts teamRefId to integer (API expects integer, not string)
func parseTeamRefId(value interface{}) interface{} {
	switch v := value.(type) {
	case string:
		if intVal, err := strconv.Atoi(v); err == nil {
			return intVal
		}
		return v // Return original if conversion fails
	case float64:
		return int(v)
	case int:
		return v
	default:
		return v
	}
}

// toIntegrationTypeArray converts integrationType to array format (API expects array)
func toIntegrationTypeArray(value interface{}) interface{} {
	switch v := value.(type) {
	case string:
		if v != "" {
			return []string{v}
		}
		return nil
	case []string:
		return v
	case []interface{}:
		return v
	default:
		return value
	}
}

// ===== AI Coding Assistant Insights API =====

// GetAIUsageMetrics retrieves feature metrics for AI coding assistants
// POST /v2/insights/coding-assistant/usage/metrics
func (s *AIInsightsService) GetAIUsageMetrics(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	requestBody := map[string]interface{}{}

	// Required fields
	if teamRefId, ok := params["teamRefId"]; ok {
		requestBody["teamRefId"] = parseTeamRefId(teamRefId)
	}
	if startDate, ok := params["startDate"]; ok {
		requestBody["startDate"] = startDate
	}
	if endDate, ok := params["endDate"]; ok {
		requestBody["endDate"] = endDate
	}

	// Optional fields
	if granularity, ok := params["granularity"]; ok {
		requestBody["granularity"] = granularity
	}
	if metricType, ok := params["metricType"]; ok {
		requestBody["metricType"] = metricType
	}
	if integrationType, ok := params["integrationType"]; ok {
		if arr := toIntegrationTypeArray(integrationType); arr != nil {
			requestBody["integrationType"] = arr
		}
	}

	queryParams := buildQueryParams(params)
	headers := buildAccountHeader(params)

	return s.makePostRequest(ctx, "/v2/insights/coding-assistant/usage/metrics", requestBody, queryParams, headers)
}

// GetAIUsageBreakdown retrieves team breakdown metrics for AI coding assistants
// POST /v2/insights/coding-assistant/usage/breakdown
func (s *AIInsightsService) GetAIUsageBreakdown(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	requestBody := map[string]interface{}{}

	if teamRefId, ok := params["teamRefId"]; ok {
		requestBody["teamRefId"] = parseTeamRefId(teamRefId)
	}
	if startDate, ok := params["startDate"]; ok {
		requestBody["startDate"] = startDate
	}
	if endDate, ok := params["endDate"]; ok {
		requestBody["endDate"] = endDate
	}
	if granularity, ok := params["granularity"]; ok {
		requestBody["granularity"] = granularity
	}
	if metricType, ok := params["metricType"]; ok {
		requestBody["metricType"] = metricType
	}
	if integrationType, ok := params["integrationType"]; ok {
		if arr := toIntegrationTypeArray(integrationType); arr != nil {
			requestBody["integrationType"] = arr
		}
	}

	queryParams := buildQueryParams(params)
	headers := buildAccountHeader(params)

	return s.makePostRequest(ctx, "/v2/insights/coding-assistant/usage/breakdown", requestBody, queryParams, headers)
}

// GetAITopLanguages retrieves top programming languages used with AI assistants
// POST /v2/insights/coding-assistant/usage/top_languages
func (s *AIInsightsService) GetAITopLanguages(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	requestBody := map[string]interface{}{}

	if teamRefId, ok := params["teamRefId"]; ok {
		requestBody["teamRefId"] = parseTeamRefId(teamRefId)
	}
	if startDate, ok := params["startDate"]; ok {
		requestBody["startDate"] = startDate
	}
	if endDate, ok := params["endDate"]; ok {
		requestBody["endDate"] = endDate
	}
	if integrationType, ok := params["integrationType"]; ok {
		if arr := toIntegrationTypeArray(integrationType); arr != nil {
			requestBody["integrationType"] = arr
		}
	}

	queryParams := buildQueryParams(params)
	headers := buildAccountHeader(params)

	return s.makePostRequest(ctx, "/v2/insights/coding-assistant/usage/top_languages", requestBody, queryParams, headers)
}

// GetAIUsageSummary retrieves summary statistics for AI coding assistants
// POST /v2/insights/coding-assistant/usage/summary
func (s *AIInsightsService) GetAIUsageSummary(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	requestBody := map[string]interface{}{}

	if teamRefId, ok := params["teamRefId"]; ok {
		requestBody["teamRefId"] = parseTeamRefId(teamRefId)
	}
	if startDate, ok := params["startDate"]; ok {
		requestBody["startDate"] = startDate
	}
	if endDate, ok := params["endDate"]; ok {
		requestBody["endDate"] = endDate
	}
	if integrationType, ok := params["integrationType"]; ok {
		if arr := toIntegrationTypeArray(integrationType); arr != nil {
			requestBody["integrationType"] = arr
		}
	}

	queryParams := buildQueryParams(params)
	headers := buildAccountHeader(params)

	return s.makePostRequest(ctx, "/v2/insights/coding-assistant/usage/summary", requestBody, queryParams, headers)
}

// GetAIAdoptions retrieves adoption metrics for AI coding assistants
// POST /v2/insights/coding-assistant/adoptions
func (s *AIInsightsService) GetAIAdoptions(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	requestBody := map[string]interface{}{}

	if teamRefId, ok := params["teamRefId"]; ok {
		requestBody["teamRefId"] = parseTeamRefId(teamRefId)
	}
	if startDate, ok := params["startDate"]; ok {
		requestBody["startDate"] = startDate
	}
	if endDate, ok := params["endDate"]; ok {
		requestBody["endDate"] = endDate
	}
	if granularity, ok := params["granularity"]; ok {
		requestBody["granularity"] = granularity
	}
	if integrationType, ok := params["integrationType"]; ok {
		if arr := toIntegrationTypeArray(integrationType); arr != nil {
			requestBody["integrationType"] = arr
		}
	}

	queryParams := buildQueryParams(params)
	headers := buildAccountHeader(params)

	return s.makePostRequest(ctx, "/v2/insights/coding-assistant/adoptions", requestBody, queryParams, headers)
}

// GetAIAdoptionsBreakdown retrieves adoption breakdown by child teams
// POST /v2/insights/coding-assistant/adoptions/breakdown
func (s *AIInsightsService) GetAIAdoptionsBreakdown(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	requestBody := map[string]interface{}{}

	if teamRefId, ok := params["teamRefId"]; ok {
		requestBody["teamRefId"] = parseTeamRefId(teamRefId)
	}
	if startDate, ok := params["startDate"]; ok {
		requestBody["startDate"] = startDate
	}
	if endDate, ok := params["endDate"]; ok {
		requestBody["endDate"] = endDate
	}
	if integrationType, ok := params["integrationType"]; ok {
		if arr := toIntegrationTypeArray(integrationType); arr != nil {
			requestBody["integrationType"] = arr
		}
	}

	queryParams := buildQueryParams(params)
	headers := buildAccountHeader(params)

	return s.makePostRequest(ctx, "/v2/insights/coding-assistant/adoptions/breakdown", requestBody, queryParams, headers)
}

// GetAIAdoptionsSummary retrieves adoption summary with period comparison
// POST /v2/insights/coding-assistant/adoptions/summary
func (s *AIInsightsService) GetAIAdoptionsSummary(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	requestBody := map[string]interface{}{}

	if teamRefId, ok := params["teamRefId"]; ok {
		requestBody["teamRefId"] = parseTeamRefId(teamRefId)
	}
	if startDate, ok := params["startDate"]; ok {
		requestBody["startDate"] = startDate
	}
	if endDate, ok := params["endDate"]; ok {
		requestBody["endDate"] = endDate
	}
	if integrationType, ok := params["integrationType"]; ok {
		if arr := toIntegrationTypeArray(integrationType); arr != nil {
			requestBody["integrationType"] = arr
		}
	}

	queryParams := buildQueryParams(params)
	headers := buildAccountHeader(params)

	return s.makePostRequest(ctx, "/v2/insights/coding-assistant/adoptions/summary", requestBody, queryParams, headers)
}

// GetAIRawMetrics retrieves raw metrics for AI coding assistants
// POST /v2/insights/coding-assistant/raw_metrics
func (s *AIInsightsService) GetAIRawMetrics(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	requestBody := map[string]interface{}{}

	if teamRefId, ok := params["teamRefId"]; ok {
		requestBody["teamRefId"] = parseTeamRefId(teamRefId)
	}
	if startDate, ok := params["startDate"]; ok {
		requestBody["startDate"] = startDate
	}
	if endDate, ok := params["endDate"]; ok {
		requestBody["endDate"] = endDate
	}
	if integrationType, ok := params["integrationType"]; ok {
		if arr := toIntegrationTypeArray(integrationType); arr != nil {
			requestBody["integrationType"] = arr
		}
	}
	if rawMetricType, ok := params["type"]; ok {
		requestBody["type"] = rawMetricType
	}
	if page, ok := params["page"]; ok {
		requestBody["page"] = page
	}
	if pageSize, ok := params["pageSize"]; ok {
		requestBody["pageSize"] = pageSize
	}

	queryParams := buildQueryParams(params)
	headers := buildAccountHeader(params)

	return s.makePostRequest(ctx, "/v2/insights/coding-assistant/raw_metrics", requestBody, queryParams, headers)
}

// GetAIRawMetricsV2 retrieves raw metrics v2 for AI coding assistants
// POST /v2/insights/coding-assistant/raw_metrics/v2
func (s *AIInsightsService) GetAIRawMetricsV2(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	requestBody := map[string]interface{}{}

	if teamRefId, ok := params["teamRefId"]; ok {
		requestBody["teamRefId"] = parseTeamRefId(teamRefId)
	}
	if startDate, ok := params["startDate"]; ok {
		requestBody["startDate"] = startDate
	}
	if endDate, ok := params["endDate"]; ok {
		requestBody["endDate"] = endDate
	}
	if integrationType, ok := params["integrationType"]; ok {
		if arr := toIntegrationTypeArray(integrationType); arr != nil {
			requestBody["integrationType"] = arr
		}
	}
	if rawMetricType, ok := params["type"]; ok {
		requestBody["type"] = rawMetricType
	}
	if page, ok := params["page"]; ok {
		requestBody["page"] = page
	}
	if pageSize, ok := params["pageSize"]; ok {
		requestBody["pageSize"] = pageSize
	}

	queryParams := buildQueryParams(params)
	headers := buildAccountHeader(params)

	return s.makePostRequest(ctx, "/v2/insights/coding-assistant/raw_metrics/v2", requestBody, queryParams, headers)
}

// GetAIPRVelocitySummary retrieves PR velocity summary for AI coding assistants
// POST /v2/insights/coding-assistant/pr-velocity/summary
func (s *AIInsightsService) GetAIPRVelocitySummary(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	requestBody := map[string]interface{}{}

	if teamRefId, ok := params["teamRefId"]; ok {
		requestBody["teamRefId"] = parseTeamRefId(teamRefId)
	}
	if startDate, ok := params["startDate"]; ok {
		requestBody["startDate"] = startDate
	}
	if endDate, ok := params["endDate"]; ok {
		requestBody["endDate"] = endDate
	}
	if integrationType, ok := params["integrationType"]; ok {
		if arr := toIntegrationTypeArray(integrationType); arr != nil {
			requestBody["integrationType"] = arr
		}
	}

	queryParams := buildQueryParams(params)
	headers := buildAccountHeader(params)

	return s.makePostRequest(ctx, "/v2/insights/coding-assistant/pr-velocity/summary", requestBody, queryParams, headers)
}

// GetAIReworkSummary retrieves rework summary for AI coding assistants
// POST /v2/insights/coding-assistant/rework/summary
func (s *AIInsightsService) GetAIReworkSummary(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	requestBody := map[string]interface{}{}

	if teamRefId, ok := params["teamRefId"]; ok {
		requestBody["teamRefId"] = parseTeamRefId(teamRefId)
	}
	if startDate, ok := params["startDate"]; ok {
		requestBody["startDate"] = startDate
	}
	if endDate, ok := params["endDate"]; ok {
		requestBody["endDate"] = endDate
	}
	if integrationType, ok := params["integrationType"]; ok {
		if arr := toIntegrationTypeArray(integrationType); arr != nil {
			requestBody["integrationType"] = arr
		}
	}

	queryParams := buildQueryParams(params)
	headers := buildAccountHeader(params)

	return s.makePostRequest(ctx, "/v2/insights/coding-assistant/rework/summary", requestBody, queryParams, headers)
}
