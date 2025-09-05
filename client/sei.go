package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
)

// SEIService handles communication with the SEI API
type SEIService struct {
	Client  *Client
	BaseURL string
	Secret  string
}

// NewSEIService creates a new SEIService with the given client and baseURL
func NewSEIService(client *Client, baseURL, secret string) *SEIService {
	// Ensure the baseURL ends with a trailing slash
	if !strings.HasSuffix(baseURL, "/") {
		baseURL = baseURL + "/"
	}
	return &SEIService{
		Client:  client,
		BaseURL: baseURL,
		Secret:  secret,
	}
}

// makePostRequest makes a POST request with JSON body
func (s *SEIService) makePostRequest(ctx context.Context, path string, body interface{}, queryParams map[string]string, additionalHeaders ...map[string]string) (interface{}, error) {
	var response interface{}
	headers := map[string]string{
		"Content-Type": "application/json",
	}

	// Add authentication header if secret is provided
	if s.Secret != "" {
		slog.Info("SEI - Adding Authorization header with ApiKey")
		headers["Authorization"] = "ApiKey " + s.Secret
	} else {
		slog.Info("SEI - No authentication header added")
	}

	// Add any additional headers
	for _, additionalHeader := range additionalHeaders {
		for key, value := range additionalHeader {
			headers[key] = value
		}
	}

	// Marshal body to JSON
	bodyBytes, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request body: %w", err)
	}

	// Use PostRaw to include custom headers
	err = s.Client.PostRaw(ctx, path, queryParams, bytes.NewBuffer(bodyBytes), headers, &response)
	if err != nil {
		slog.Error("SEI - Post Request failed", "error", err)
		return nil, fmt.Errorf("POST request failed: %w", err)
	}

	return response, nil
}

// GetProductivityFeatureMetrics gets productivity feature metrics
// Makes a POST request to /v2/productivityv3/feature_metrics with JSON body and query parameters
func (s *SEIService) GetProductivityFeatureMetrics(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	// Build request body from params
	requestBody := map[string]interface{}{}

	// Required fields for request body
	if startDate, ok := params["startDate"]; ok {
		requestBody["startDate"] = startDate
	}
	if endDate, ok := params["endDate"]; ok {
		requestBody["endDate"] = endDate
	}
	if featureType, ok := params["featureType"]; ok {
		requestBody["featureType"] = featureType
	}

	// Optional fields for request body
	if granularity, ok := params["granularity"]; ok {
		requestBody["granularity"] = granularity
	}
	if developerIds, ok := params["developerIds"]; ok {
		requestBody["developerIds"] = developerIds
	}
	if developerRefIds, ok := params["developerRefIds"]; ok {
		requestBody["developerRefIds"] = developerRefIds
	}
	if teamRefIds, ok := params["teamRefIds"]; ok {
		requestBody["teamRefIds"] = teamRefIds
	}
	if teamIds, ok := params["teamIds"]; ok {
		requestBody["teamIds"] = teamIds
	}
	if teamId, ok := params["teamId"]; ok {
		requestBody["teamId"] = teamId
	}
	if stackBy, ok := params["stackBy"]; ok {
		requestBody["stackBy"] = stackBy
	}

	// Pagination parameters in request body
	if page, ok := params["page"]; ok {
		requestBody["page"] = page
	}
	if pageSize, ok := params["page_size"]; ok {
		requestBody["page_size"] = pageSize
	}

	// Sorting parameters in request body
	if sortBy, ok := params["sortBy"]; ok {
		requestBody["sortBy"] = sortBy
	}
	if sortByCriteria, ok := params["sortByCriteria"]; ok {
		requestBody["sortByCriteria"] = sortByCriteria
	}

	// Build query parameters from session attributes
	queryParams := map[string]string{}
	if accountId, ok := params["accountId"]; ok {
		if accountStr, ok := accountId.(string); ok {
			queryParams["account"] = accountStr
		}
	}
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

	fmt.Println("Request Body: ", requestBody)
	fmt.Println("Query Parameters: ", queryParams)

	return s.makePostRequest(ctx, "/v2/productivityv3/feature_metrics", requestBody, queryParams)
}

// GetEfficiencyLeadTime gets lead time
// Makes a POST request to /v2/insights/efficiency/leadtime with JSON body and query parameters
func (s *SEIService) GetEfficiencyLeadTime(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	// Build request body from params
	requestBody := map[string]interface{}{}

	// Required fields for request body
	if teamRefId, ok := params["teamRefId"]; ok {
		requestBody["teamRefId"] = teamRefId
	}
	if dateStart, ok := params["dateStart"]; ok {
		requestBody["dateStart"] = dateStart
	}
	if dateEnd, ok := params["dateEnd"]; ok {
		requestBody["dateEnd"] = dateEnd
	}
	if granularity, ok := params["granularity"]; ok {
		requestBody["granularity"] = granularity
	}

	// Build query parameters from session attributes
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
	// Add account query parameter to match working curl command
	if accountId, ok := params["accountId"]; ok {
		if accountStr, ok := accountId.(string); ok {
			queryParams["account"] = accountStr
		}
	}

	return s.makePostRequest(ctx, "/v2/insights/efficiency/leadtime", requestBody, queryParams)
}

// GetDeploymentFrequency gets deployment frequency metrics
// Makes a POST request to /v2/insights/efficiency/deploymentFrequency with JSON body and query parameters
func (s *SEIService) GetDeploymentFrequency(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	// Build request body from params
	requestBody := map[string]interface{}{}

	// Required fields for request body
	if teamRefId, ok := params["teamRefId"]; ok {
		requestBody["teamRefId"] = teamRefId
	}
	if dateStart, ok := params["dateStart"]; ok {
		requestBody["dateStart"] = dateStart
	}
	if dateEnd, ok := params["dateEnd"]; ok {
		requestBody["dateEnd"] = dateEnd
	}
	if granularity, ok := params["granularity"]; ok {
		requestBody["granularity"] = granularity
	}

	// Optional fields for request body
	if drillDownStartDate, ok := params["drillDownStartDate"]; ok {
		requestBody["drillDownStartDate"] = drillDownStartDate
	}
	if drillDownEndDate, ok := params["drillDownEndDate"]; ok {
		requestBody["drillDownEndDate"] = drillDownEndDate
	}
	if page, ok := params["page"]; ok {
		requestBody["page"] = page
	}
	if pageSize, ok := params["pageSize"]; ok {
		requestBody["pageSize"] = pageSize
	}

	// Build query parameters from session attributes
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
	if accountId, ok := params["accountId"]; ok {
		if accountStr, ok := accountId.(string); ok {
			queryParams["account"] = accountStr
		}
	}

	return s.makePostRequest(ctx, "/v2/insights/efficiency/deploymentFrequency", requestBody, queryParams)
}

// GetChangeFailureRate gets change failure rate metrics
// Makes a POST request to /v2/insights/efficiency/changeFailureRate with JSON body and query parameters
func (s *SEIService) GetChangeFailureRate(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	// Build request body from params
	requestBody := map[string]interface{}{}

	// Required fields for request body
	if teamRefId, ok := params["teamRefId"]; ok {
		requestBody["teamRefId"] = teamRefId
	}
	if dateStart, ok := params["dateStart"]; ok {
		requestBody["dateStart"] = dateStart
	}
	if dateEnd, ok := params["dateEnd"]; ok {
		requestBody["dateEnd"] = dateEnd
	}
	if granularity, ok := params["granularity"]; ok {
		requestBody["granularity"] = granularity
	}

	// Optional fields for request body
	if drillDownStartDate, ok := params["drillDownStartDate"]; ok {
		requestBody["drillDownStartDate"] = drillDownStartDate
	}
	if drillDownEndDate, ok := params["drillDownEndDate"]; ok {
		requestBody["drillDownEndDate"] = drillDownEndDate
	}
	if page, ok := params["page"]; ok {
		requestBody["page"] = page
	}
	if pageSize, ok := params["pageSize"]; ok {
		requestBody["pageSize"] = pageSize
	}

	// Build query parameters from session attributes
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
	if accountId, ok := params["accountId"]; ok {
		if accountStr, ok := accountId.(string); ok {
			queryParams["account"] = accountStr
		}
	}

	return s.makePostRequest(ctx, "/v2/insights/efficiency/changeFailureRate", requestBody, queryParams)
}

// GetMttr gets Mean Time to Restore metrics
// Makes a POST request to /v2/insights/efficiency/mttr with JSON body and query parameters
func (s *SEIService) GetMttr(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	// Extract query parameters
	queryParams := map[string]string{
		"account":           fmt.Sprintf("%v", params["accountId"]),
		"projectIdentifier": fmt.Sprintf("%v", params["projectId"]),
		"orgIdentifier":     fmt.Sprintf("%v", params["orgId"]),
	}

	// Build request body
	body := map[string]interface{}{
		"teamRefId":   params["teamRefId"],
		"dateStart":   params["dateStart"],
		"dateEnd":     params["dateEnd"],
		"granularity": params["granularity"],
	}

	// Add optional parameters if they exist
	if drillDownStartDate, ok := params["drillDownStartDate"]; ok && drillDownStartDate != "" {
		body["drillDownStartDate"] = drillDownStartDate
	}
	if drillDownEndDate, ok := params["drillDownEndDate"]; ok && drillDownEndDate != "" {
		body["drillDownEndDate"] = drillDownEndDate
	}
	if page, ok := params["page"]; ok {
		body["page"] = page
	}
	if pageSize, ok := params["pageSize"]; ok {
		body["pageSize"] = pageSize
	}

	path := "v2/insights/efficiency/mttr"
	return s.makePostRequest(ctx, path, body, queryParams)
}

// GetDeploymentFrequencyDrilldown gets deployment frequency drilldown data
// Makes a POST request to /v2/insights/efficiency/deploymentFrequency/drilldown with JSON body and query parameters
func (s *SEIService) GetDeploymentFrequencyDrilldown(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	// Build request body from params
	requestBody := map[string]interface{}{}

	// Required fields for request body
	if teamRefId, ok := params["teamRefId"]; ok {
		requestBody["teamRefId"] = teamRefId
	}
	if dateStart, ok := params["dateStart"]; ok {
		requestBody["dateStart"] = dateStart
	}
	if dateEnd, ok := params["dateEnd"]; ok {
		requestBody["dateEnd"] = dateEnd
	}

	// Optional fields for request body
	if sortOption, ok := params["sortOption"]; ok {
		requestBody["sortOption"] = sortOption
	}
	if page, ok := params["page"]; ok {
		requestBody["page"] = page
	}
	if pageSize, ok := params["pageSize"]; ok {
		requestBody["pageSize"] = pageSize
	}

	// Build query parameters from session attributes
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
	if accountId, ok := params["accountId"]; ok {
		if accountStr, ok := accountId.(string); ok {
			queryParams["account"] = accountStr
		}
	}

	return s.makePostRequest(ctx, "/v2/insights/efficiency/deploymentFrequency/drilldown", requestBody, queryParams)
}

// GetChangeFailureRateDrilldown gets change failure rate drilldown data
// Makes a POST request to /v2/insights/efficiency/changeFailureRate/drilldown with JSON body and query parameters
func (s *SEIService) GetChangeFailureRateDrilldown(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	// Build request body from params
	requestBody := map[string]interface{}{}

	// Required fields for request body
	if teamRefId, ok := params["teamRefId"]; ok {
		requestBody["teamRefId"] = teamRefId
	}
	if dateStart, ok := params["dateStart"]; ok {
		requestBody["dateStart"] = dateStart
	}
	if dateEnd, ok := params["dateEnd"]; ok {
		requestBody["dateEnd"] = dateEnd
	}

	// Optional fields for request body
	if sortOption, ok := params["sortOption"]; ok {
		requestBody["sortOption"] = sortOption
	}
	if page, ok := params["page"]; ok {
		requestBody["page"] = page
	}
	if pageSize, ok := params["pageSize"]; ok {
		requestBody["pageSize"] = pageSize
	}

	// Build query parameters from session attributes
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
	if accountId, ok := params["accountId"]; ok {
		if accountStr, ok := accountId.(string); ok {
			queryParams["account"] = accountStr
		}
	}

	return s.makePostRequest(ctx, "/v2/insights/efficiency/changeFailureRate/drilldown", requestBody, queryParams)
}

// makeGetRequest makes a GET request with query parameters
func (s *SEIService) makeGetRequest(ctx context.Context, path string, queryParams map[string]string, additionalHeaders ...map[string]string) (interface{}, error) {
	var response interface{}
	headers := map[string]string{}

	// Add authentication header if secret is provided
	if s.Secret != "" {
		slog.Info("SEI - Adding Authorization header with ApiKey")
		headers["Authorization"] = "ApiKey " + s.Secret
	} else {
		slog.Info("SEI - No authentication header added")
	}

	// Add any additional headers
	for _, additionalHeader := range additionalHeaders {
		for key, value := range additionalHeader {
			headers[key] = value
		}
	}

	slog.Info("SEI - Get Request details", "path", path, "queryParams", queryParams, "headers", headers)

	// Use Get method to make the request
	err := s.Client.Get(ctx, path, queryParams, headers, &response)
	if err != nil {
		slog.Error("SEI - Get Request failed", "error", err)
		return nil, fmt.Errorf("GET request failed: %w", err)
	}

	return response, nil
}

// ===== Teams Controller Methods =====

// GetTeam gets team information by team reference ID
// Makes a GET request to /v2/teams/{teamRefId}/team_info
func (s *SEIService) GetTeam(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	// Extract teamRefId from params
	teamRefId, ok := params["teamRefId"]
	if !ok {
		return nil, fmt.Errorf("teamRefId is required")
	}

	// Build path with teamRefId
	path := fmt.Sprintf("/v2/teams/%v/team_info", teamRefId)

	// Build additional headers
	additionalHeaders := map[string]string{}
	if accountId, ok := params["accountId"]; ok {
		if accountStr, ok := accountId.(string); ok {
			additionalHeaders["harness-account"] = accountStr
		}
	}

	return s.makeGetRequest(ctx, path, map[string]string{}, additionalHeaders)
}

// GetTeamsList gets list of teams with pagination
// Makes a GET request to /v2/teams/list
func (s *SEIService) GetTeamsList(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	// Build query parameters
	queryParams := map[string]string{}
	if orgId, ok := params["orgId"]; ok {
		if orgStr, ok := orgId.(string); ok {
			queryParams["orgIdentifier"] = orgStr
		}
	}
	if projectId, ok := params["projectId"]; ok {
		if projectStr, ok := projectId.(string); ok {
			queryParams["projectIdentifier"] = projectStr
		}
	}
	if leafTeamsOnly, ok := params["leafTeamsOnly"]; ok {
		if leafBool, ok := leafTeamsOnly.(bool); ok {
			if leafBool {
				queryParams["leafTeamsOnly"] = "true"
			} else {
				queryParams["leafTeamsOnly"] = "false"
			}
		}
	}
	if page, ok := params["page"]; ok {
		queryParams["page"] = fmt.Sprintf("%v", page)
	}
	if pageSize, ok := params["pageSize"]; ok {
		queryParams["pageSize"] = fmt.Sprintf("%v", pageSize)
	}

	// Build additional headers
	additionalHeaders := map[string]string{}
	if accountId, ok := params["accountId"]; ok {
		if accountStr, ok := accountId.(string); ok {
			additionalHeaders["harness-account"] = accountStr
		}
	}

	return s.makeGetRequest(ctx, "/v2/teams/list", queryParams, additionalHeaders)
}

// GetTeamIntegrations gets team integrations by team reference ID
// Makes a GET request to /v2/teams/{teamRefId}/integrations
func (s *SEIService) GetTeamIntegrations(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	// Extract teamRefId from params
	teamRefId, ok := params["teamRefId"]
	if !ok {
		return nil, fmt.Errorf("teamRefId is required")
	}

	// Build path with teamRefId
	path := fmt.Sprintf("/v2/teams/%v/integrations", teamRefId)

	// Build additional headers
	additionalHeaders := map[string]string{}
	if accountId, ok := params["accountId"]; ok {
		if accountStr, ok := accountId.(string); ok {
			additionalHeaders["harness-account"] = accountStr
		}
	}

	return s.makeGetRequest(ctx, path, map[string]string{}, additionalHeaders)
}

// GetTeamDevelopers gets team developers by team reference ID
// Makes a GET request to /v2/teams/{teamRefId}/developers
func (s *SEIService) GetTeamDevelopers(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	// Extract teamRefId from params
	teamRefId, ok := params["teamRefId"]
	if !ok {
		return nil, fmt.Errorf("teamRefId is required")
	}

	// Build path with teamRefId
	path := fmt.Sprintf("/v2/teams/%v/developers", teamRefId)

	// Build query parameters
	queryParams := map[string]string{}
	if page, ok := params["page"]; ok {
		queryParams["page"] = fmt.Sprintf("%v", page)
	}
	if size, ok := params["size"]; ok {
		queryParams["size"] = fmt.Sprintf("%v", size)
	}

	// Build additional headers
	additionalHeaders := map[string]string{}
	if accountId, ok := params["accountId"]; ok {
		if accountStr, ok := accountId.(string); ok {
			additionalHeaders["harness-account"] = accountStr
		}
	}

	return s.makeGetRequest(ctx, path, queryParams, additionalHeaders)
}

// GetTeamIntegrationFilters gets team integration filters by team reference ID
// Makes a GET request to /v2/teams/{teamRefId}/integration_filters
func (s *SEIService) GetTeamIntegrationFilters(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	// Extract teamRefId from params
	teamRefId, ok := params["teamRefId"]
	if !ok {
		return nil, fmt.Errorf("teamRefId is required")
	}

	// Build path with teamRefId
	path := fmt.Sprintf("/v2/teams/%v/integration_filters", teamRefId)

	// Build query parameters
	queryParams := map[string]string{}
	if integrationType, ok := params["integrationType"]; ok {
		if integrationStr, ok := integrationType.(string); ok {
			queryParams["integrationType"] = integrationStr
		}
	}

	// Build additional headers
	additionalHeaders := map[string]string{}
	if accountId, ok := params["accountId"]; ok {
		if accountStr, ok := accountId.(string); ok {
			additionalHeaders["harness-account"] = accountStr
		}
	}

	return s.makeGetRequest(ctx, path, queryParams, additionalHeaders)
}

// ===== OrgTree Controller Methods =====

// GetOrgTrees gets organization trees with pagination
// Makes a GET request to /v2/org-trees
func (s *SEIService) GetOrgTrees(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	// Build query parameters
	queryParams := map[string]string{}
	if orgId, ok := params["orgId"]; ok {
		if orgStr, ok := orgId.(string); ok {
			queryParams["orgIdentifer"] = orgStr // Note: API uses "orgIdentifer" (typo in original)
		}
	}
	if projectId, ok := params["projectId"]; ok {
		if projectStr, ok := projectId.(string); ok {
			queryParams["projectIdentifier"] = projectStr
		}
	}
	if pageIndex, ok := params["pageIndex"]; ok {
		queryParams["pageIndex"] = fmt.Sprintf("%v", pageIndex)
	} else {
		queryParams["pageIndex"] = "0"
	}
	if pageSize, ok := params["pageSize"]; ok {
		queryParams["pageSize"] = fmt.Sprintf("%v", pageSize)
	} else {
		queryParams["pageSize"] = "50"
	}

	// Build additional headers
	additionalHeaders := map[string]string{}
	if accountId, ok := params["accountId"]; ok {
		if accountStr, ok := accountId.(string); ok {
			additionalHeaders["harness-account"] = accountStr
		}
	}

	return s.makeGetRequest(ctx, "/v2/org-trees", queryParams, additionalHeaders)
}

// GetOrgTreeById gets a specific organization tree by ID
// Makes a GET request to /v2/org-trees/{id}
func (s *SEIService) GetOrgTreeById(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	// Extract id from params
	id, ok := params["id"]
	if !ok {
		return nil, fmt.Errorf("id is required")
	}

	// Build path with id
	path := fmt.Sprintf("/v2/org-trees/%v", id)

	// Build additional headers
	additionalHeaders := map[string]string{}
	if accountId, ok := params["accountId"]; ok {
		if accountStr, ok := accountId.(string); ok {
			additionalHeaders["harness-account"] = accountStr
		}
	}

	return s.makeGetRequest(ctx, path, map[string]string{}, additionalHeaders)
}

// GetOrgTreeEfficiencyProfile gets efficiency profile reference ID for an organization tree
// Makes a GET request to /v2/org-trees/{orgTreeId}/efficiency_profile
func (s *SEIService) GetOrgTreeEfficiencyProfile(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	// Extract orgTreeId from params
	orgTreeId, ok := params["orgTreeId"]
	if !ok {
		return nil, fmt.Errorf("orgTreeId is required")
	}

	// Build path with orgTreeId
	path := fmt.Sprintf("/v2/org-trees/%v/efficiency_profile", orgTreeId)

	// Build additional headers
	additionalHeaders := map[string]string{}
	if accountId, ok := params["accountId"]; ok {
		if accountStr, ok := accountId.(string); ok {
			additionalHeaders["harness-account"] = accountStr
		}
	}

	return s.makeGetRequest(ctx, path, map[string]string{}, additionalHeaders)
}

// GetOrgTreeProductivityProfile gets productivity profile reference ID for an organization tree
// Makes a GET request to /v2/org-trees/{orgTreeId}/productivity_profile
func (s *SEIService) GetOrgTreeProductivityProfile(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	// Extract orgTreeId from params
	orgTreeId, ok := params["orgTreeId"]
	if !ok {
		return nil, fmt.Errorf("orgTreeId is required")
	}

	// Build path with orgTreeId
	path := fmt.Sprintf("/v2/org-trees/%v/productivity_profile", orgTreeId)

	// Build additional headers
	additionalHeaders := map[string]string{}
	if accountId, ok := params["accountId"]; ok {
		if accountStr, ok := accountId.(string); ok {
			additionalHeaders["harness-account"] = accountStr
		}
	}

	return s.makeGetRequest(ctx, path, map[string]string{}, additionalHeaders)
}

// GetOrgTreeBusinessAlignmentProfile gets business alignment profile reference ID for an organization tree
// Makes a GET request to /v2/org-trees/{orgTreeId}/businessAlignmentProfile
func (s *SEIService) GetOrgTreeBusinessAlignmentProfile(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	// Extract orgTreeId from params
	orgTreeId, ok := params["orgTreeId"]
	if !ok {
		return nil, fmt.Errorf("orgTreeId is required")
	}

	// Build path with orgTreeId
	path := fmt.Sprintf("/v2/org-trees/%v/businessAlignmentProfile", orgTreeId)

	// Build additional headers
	additionalHeaders := map[string]string{}
	if accountId, ok := params["accountId"]; ok {
		if accountStr, ok := accountId.(string); ok {
			additionalHeaders["harness-account"] = accountStr
		}
	}

	return s.makeGetRequest(ctx, path, map[string]string{}, additionalHeaders)
}

// GetOrgTreeIntegrations gets integrations associated with an organization tree
// Makes a GET request to /v2/org-trees/{orgTreeId}/integrations
func (s *SEIService) GetOrgTreeIntegrations(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	// Extract orgTreeId from params
	orgTreeId, ok := params["orgTreeId"]
	if !ok {
		return nil, fmt.Errorf("orgTreeId is required")
	}

	// Build path with orgTreeId
	path := fmt.Sprintf("/v2/org-trees/%v/integrations", orgTreeId)

	// Build additional headers
	additionalHeaders := map[string]string{}
	if accountId, ok := params["accountId"]; ok {
		if accountStr, ok := accountId.(string); ok {
			additionalHeaders["harness-account"] = accountStr
		}
	}

	return s.makeGetRequest(ctx, path, map[string]string{}, additionalHeaders)
}

// GetOrgTreeTeams gets team hierarchy for an organization tree
// Makes a GET request to /v2/org-trees/{orgTreeId}/teams
func (s *SEIService) GetOrgTreeTeams(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	// Extract orgTreeId from params
	orgTreeId, ok := params["orgTreeId"]
	if !ok {
		return nil, fmt.Errorf("orgTreeId is required")
	}

	// Build path with orgTreeId
	path := fmt.Sprintf("/v2/org-trees/%v/teams", orgTreeId)

	// Build additional headers
	additionalHeaders := map[string]string{}
	if accountId, ok := params["accountId"]; ok {
		if accountStr, ok := accountId.(string); ok {
			additionalHeaders["harness-account"] = accountStr
		}
	}

	return s.makeGetRequest(ctx, path, map[string]string{}, additionalHeaders)
}

// ===== BA Controller Methods =====

// GetBAAllProfiles gets all BA profiles
// Makes a GET request to /v2/insights/ba/profiles
func (s *SEIService) GetBAAllProfiles(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	// Build query parameters
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

	// Build additional headers
	additionalHeaders := map[string]string{}
	if accountId, ok := params["accountId"]; ok {
		if accountStr, ok := accountId.(string); ok {
			additionalHeaders["harness-account"] = accountStr
		}
	}

	return s.makeGetRequest(ctx, "/v2/insights/ba/profiles", queryParams, additionalHeaders)
}

// GetBAInsightMetrics gets BA insight metrics
// Makes a POST request to /v2/insights/ba/feature_metrics
func (s *SEIService) GetBAInsightMetrics(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	// Build request body from params
	requestBody := map[string]interface{}{}

	// Extract request body from params (should be BAInsightRequestDTO)
	if requestData, ok := params["request"]; ok {
		requestBody = requestData.(map[string]interface{})
	}

	// Build query parameters
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

	// Build additional headers
	additionalHeaders := map[string]string{}
	if accountId, ok := params["accountId"]; ok {
		if accountStr, ok := accountId.(string); ok {
			additionalHeaders["harness-account"] = accountStr
		}
	}

	return s.makePostRequest(ctx, "/v2/insights/ba/feature_metrics", requestBody, queryParams, additionalHeaders)
}

// GetBAInsightSummary gets BA insight summary
// Makes a POST request to /v2/insights/ba/feature_summary
func (s *SEIService) GetBAInsightSummary(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	// Build request body from params
	requestBody := map[string]interface{}{}

	// Extract request body from params (should be BASummaryRequestDTO)
	if requestData, ok := params["request"]; ok {
		requestBody = requestData.(map[string]interface{})
	}

	// Build query parameters
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

	// Build additional headers
	additionalHeaders := map[string]string{}
	if accountId, ok := params["accountId"]; ok {
		if accountStr, ok := accountId.(string); ok {
			additionalHeaders["harness-account"] = accountStr
		}
	}

	return s.makePostRequest(ctx, "/v2/insights/ba/feature_summary", requestBody, queryParams, additionalHeaders)
}

// GetBADrilldownData gets BA drilldown data
// Makes a POST request to /v2/insights/ba/drilldown
func (s *SEIService) GetBADrilldownData(ctx context.Context, params map[string]interface{}) (interface{}, error) {
	// Build request body from params
	requestBody := map[string]interface{}{}

	// Extract request body from params (should be BADrilldownRequestDTO)
	if requestData, ok := params["request"]; ok {
		requestBody = requestData.(map[string]interface{})
	}

	// Build query parameters
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

	// Build additional headers
	additionalHeaders := map[string]string{}
	if accountId, ok := params["accountId"]; ok {
		if accountStr, ok := accountId.(string); ok {
			additionalHeaders["harness-account"] = accountStr
		}
	}

	return s.makePostRequest(ctx, "/v2/insights/ba/drilldown", requestBody, queryParams, additionalHeaders)
}
