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

	if s.Secret != "" {
		headers["Authorization"] = "ApiKey " + s.Secret
	}

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
	if projectId, ok := params["projectId"].(string); ok {
		queryParams["projectIdentifier"] = projectId
	}
	if orgId, ok := params["orgId"].(string); ok {
		queryParams["orgIdentifier"] = orgId
	}
	return queryParams
}

// buildAccountHeader builds the harness-account header
func buildAccountHeader(params map[string]interface{}) map[string]string {
	headers := map[string]string{}
	if accountId, ok := params["accountId"].(string); ok {
		headers["harness-account"] = accountId
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
		return v
	case float64:
		return int(v)
	case int:
		return v
	default:
		return v
	}
}

// toIntegrationTypeArray converts integrationType to array format (API expects array).
// "all_assistants" is expanded to ["cursor", "windsurf"] so the backend fetches both.
func toIntegrationTypeArray(value interface{}) interface{} {
	switch v := value.(type) {
	case string:
		if v == "all_assistants" {
			return []string{"cursor", "windsurf"}
		}
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

// buildBaseRequestBody builds the common request body with base fields
func buildBaseRequestBody(params map[string]interface{}) map[string]interface{} {
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

	return requestBody
}

// executeRequest is a helper that builds common params and executes the request
func (s *AIInsightsService) executeRequest(ctx context.Context, path string, params map[string]interface{}, extraFields map[string]string) (interface{}, error) {
	requestBody := buildBaseRequestBody(params)

	// Add extra fields from params to request body
	for paramKey, bodyKey := range extraFields {
		if val, ok := params[paramKey]; ok {
			requestBody[bodyKey] = val
		}
	}

	return s.makePostRequest(ctx, path, requestBody, buildQueryParams(params), buildAccountHeader(params))
}

// ===== AI Coding Assistant Insights API =====

// GetAIUsageMetrics retrieves feature metrics for AI coding assistants
// POST /v2/insights/coding-assistant/usage/metrics
func (s *AIInsightsService) GetAIUsageMetrics(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	return s.executeRequest(ctx, "/v2/insights/coding-assistant/usage/metrics", params, map[string]string{
		"granularity": "granularity",
		"metricType":  "metricType",
	})
}

// GetAIUsageBreakdown retrieves team breakdown metrics for AI coding assistants
// POST /v2/insights/coding-assistant/usage/breakdown
func (s *AIInsightsService) GetAIUsageBreakdown(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	return s.executeRequest(ctx, "/v2/insights/coding-assistant/usage/breakdown", params, map[string]string{
		"granularity": "granularity",
		"metricType":  "metricType",
	})
}

// GetAITopLanguages retrieves top programming languages used with AI assistants
// POST /v2/insights/coding-assistant/usage/top_languages
func (s *AIInsightsService) GetAITopLanguages(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	return s.executeRequest(ctx, "/v2/insights/coding-assistant/usage/top_languages", params, nil)
}

// GetAIUsageSummary retrieves summary statistics for AI coding assistants
// POST /v2/insights/coding-assistant/usage/summary
func (s *AIInsightsService) GetAIUsageSummary(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	return s.executeRequest(ctx, "/v2/insights/coding-assistant/usage/summary", params, nil)
}

// GetAIAdoptions retrieves adoption metrics for AI coding assistants
// POST /v2/insights/coding-assistant/adoptions
func (s *AIInsightsService) GetAIAdoptions(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	return s.executeRequest(ctx, "/v2/insights/coding-assistant/adoptions", params, map[string]string{
		"granularity": "granularity",
	})
}

// GetAIAdoptionsBreakdown retrieves adoption breakdown by child teams
// POST /v2/insights/coding-assistant/adoptions/breakdown
func (s *AIInsightsService) GetAIAdoptionsBreakdown(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	return s.executeRequest(ctx, "/v2/insights/coding-assistant/adoptions/breakdown", params, nil)
}

// GetAIAdoptionsSummary retrieves adoption summary with period comparison
// POST /v2/insights/coding-assistant/adoptions/summary
func (s *AIInsightsService) GetAIAdoptionsSummary(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	return s.executeRequest(ctx, "/v2/insights/coding-assistant/adoptions/summary", params, nil)
}

// buildPaginatedRequestBody builds request body with pagination for raw metrics endpoints
func buildPaginatedRequestBody(params map[string]interface{}) map[string]interface{} {
	requestBody := buildBaseRequestBody(params)

	// Type field
	if typeVal, ok := params["type"]; ok {
		requestBody["type"] = typeVal
	}

	// Pagination object with pageNumber and maxPageSize
	pagination := map[string]interface{}{
		"pageNumber":  0,
		"maxPageSize": 10,
	}
	if page, ok := params["page"]; ok {
		pagination["pageNumber"] = page
	}
	if pageSize, ok := params["pageSize"]; ok {
		pagination["maxPageSize"] = pageSize
	}
	requestBody["pagination"] = pagination

	return requestBody
}

// GetAIRawMetrics retrieves paginated raw metrics for AI coding assistants
// POST /v2/insights/coding-assistant/raw_metrics
func (s *AIInsightsService) GetAIRawMetrics(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	return s.makePostRequest(ctx, "/v2/insights/coding-assistant/raw_metrics",
		buildPaginatedRequestBody(params), buildQueryParams(params), buildAccountHeader(params))
}

// GetAIRawMetricsV2 retrieves paginated raw metrics (v2) with enhanced filtering
// POST /v2/insights/coding-assistant/raw_metrics/v2
func (s *AIInsightsService) GetAIRawMetricsV2(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	return s.makePostRequest(ctx, "/v2/insights/coding-assistant/raw_metrics/v2",
		buildPaginatedRequestBody(params), buildQueryParams(params), buildAccountHeader(params))
}

// GetAIPRVelocitySummary retrieves PR velocity comparison (AI-assisted vs non-AI-assisted)
// POST /v2/insights/coding-assistant/pr-velocity/summary
func (s *AIInsightsService) GetAIPRVelocitySummary(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	return s.executeRequest(ctx, "/v2/insights/coding-assistant/pr-velocity/summary", params, map[string]string{
		"granularity": "granularity",
	})
}

// GetAIReworkSummary retrieves rework comparison (AI-assisted vs non-AI-assisted)
// POST /v2/insights/coding-assistant/rework/summary
func (s *AIInsightsService) GetAIReworkSummary(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	return s.executeRequest(ctx, "/v2/insights/coding-assistant/rework/summary", params, map[string]string{
		"granularity": "granularity",
	})
}
