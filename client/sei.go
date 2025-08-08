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

// makeRequest is a helper function to make API requests to the SEI service
func (s *SEIService) makeRequest(ctx context.Context, method, path string, params map[string]interface{}) (interface{}, error) {
	// This is a placeholder implementation
	// In a real implementation, this would:
	// 1. Construct the URL from baseURL and path
	// 2. Convert params to query parameters or JSON body depending on method
	// 3. Add authentication headers using the secret
	// 4. Make the HTTP request
	// 5. Parse the response into appropriate data structures

	// For now, we return a dummy response to compile
	return map[string]interface{}{
		"message": "SEI API response",
		"method":  method,
		"path":    path,
		"params":  params,
	}, nil
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

	slog.Info("SEI - Post Request details", "body", body, "queryParams", queryParams, "headers", headers)

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

	// Build additional headers
	additionalHeaders := map[string]string{}
	if accountId, ok := params["accountId"]; ok {
		if accountStr, ok := accountId.(string); ok {
			additionalHeaders["harness-account"] = accountStr
		}
	}
	fmt.Println("Request Body: ", requestBody)
	fmt.Println("Query Parameters: ", queryParams)
	fmt.Println("Additional Headers: ", additionalHeaders)
	// return s.makePostRequest(ctx, "/gateway/sei/api/v2/productivityv3/feature_metrics", requestBody, queryParams, additionalHeaders)
	return s.makePostRequest(ctx, "/v2/productivityv3/feature_metrics", requestBody, queryParams, additionalHeaders)
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

	// Build additional headers
	additionalHeaders := map[string]string{}
	if accountId, ok := params["accountId"]; ok {
		if accountStr, ok := accountId.(string); ok {
			additionalHeaders["harness-account"] = accountStr
		}
	}

	// return s.makePostRequest(ctx, "/gateway/sei/api/v2/insights/efficiency/leadtime", requestBody, queryParams, additionalHeaders)
	return s.makePostRequest(ctx, "/v2/insights/efficiency/leadtime", requestBody, queryParams, additionalHeaders)
}


