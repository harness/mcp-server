package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"

	"github.com/harness/harness-mcp/client/dto"
)

const (
	seiBasePath                           = "sei/api/v1"
	seiDORAMetricsPath                    = seiBasePath + "/dora/metrics"
	seiBusAlignmentMetricsPath            = seiBasePath + "/business-alignment/metrics"
	seiBusAlignmentDrilldownPath          = seiBasePath + "/business-alignment/drilldown"
	seiProductivityFeatureMetricsPath     = "v2/productivity/feature_metrics"
	seiProductivityFeatureBreakdownPath   = "v2/productivity/feature_breakdown"
	seiProductivityFeatureDrilldownPath   = "v2/productivity/feature_drilldown"
	seiProductivityFeatureDrilldownIndPath = "v2/productivity/feature_drilldown_individual"
)

// SEIService provides client for Software Engineering Intelligence related operations
type SEIService struct {
	Client *Client
}

// GetDORAMetrics fetches DORA metrics for the given parameters
func (s *SEIService) GetDORAMetrics(ctx context.Context, accountID, orgID, projectID string, params map[string]string) (*dto.DORAMetricsResponse, error) {
	path := seiDORAMetricsPath
	queryParams := make(map[string]string)
	
	// Add standard account/org/project params
	if accountID != "" {
		queryParams["accountId"] = accountID
	}
	if orgID != "" {
		queryParams["orgId"] = orgID
	}
	if projectID != "" {
		queryParams["projectId"] = projectID
	}

	// Add any additional parameters
	for k, v := range params {
		queryParams[k] = v
	}

	doraMetrics := new(dto.DORAMetricsResponse)
	err := s.Client.Get(ctx, path, queryParams, nil, doraMetrics)
	if err != nil {
		return nil, fmt.Errorf("failed to get DORA metrics: %w", err)
	}

	return doraMetrics, nil
}

// GetBusinessAlignmentMetrics fetches Business Alignment metrics
func (s *SEIService) GetBusinessAlignmentMetrics(ctx context.Context, accountID, orgID, projectID string, params map[string]string) (*dto.BusinessAlignmentResponse, error) {
	path := seiBusAlignmentMetricsPath
	queryParams := make(map[string]string)
	
	// Add standard account/org/project params
	if accountID != "" {
		queryParams["accountId"] = accountID
	}
	if orgID != "" {
		queryParams["orgId"] = orgID
	}
	if projectID != "" {
		queryParams["projectId"] = projectID
	}

	// Add any additional parameters including integration_id as mentioned in memory
	for k, v := range params {
		queryParams[k] = v
	}

	businessAlignmentMetrics := new(dto.BusinessAlignmentResponse)
	err := s.Client.Get(ctx, path, queryParams, nil, businessAlignmentMetrics)
	if err != nil {
		return nil, fmt.Errorf("failed to get Business Alignment metrics: %w", err)
	}

	return businessAlignmentMetrics, nil
}

// ListBusinessAlignmentDrilldown fetches drilldown data for Business Alignment metrics
func (s *SEIService) ListBusinessAlignmentDrilldown(ctx context.Context, accountID, orgID, projectID string, params map[string]string) (*dto.BusinessAlignmentDrilldownResponse, error) {
	path := seiBusAlignmentDrilldownPath
	queryParams := make(map[string]string)
	
	// Add standard account/org/project params
	if accountID != "" {
		queryParams["accountId"] = accountID
	}
	if orgID != "" {
		queryParams["orgId"] = orgID
	}
	if projectID != "" {
		queryParams["projectId"] = projectID
	}

	// Add any additional parameters
	for k, v := range params {
		queryParams[k] = v
	}

	drilldownData := new(dto.BusinessAlignmentDrilldownResponse)
	err := s.Client.Get(ctx, path, queryParams, nil, drilldownData)
	if err != nil {
		return nil, fmt.Errorf("failed to get Business Alignment drilldown data: %w", err)
	}

	return drilldownData, nil
}

// GetProductivityFeatureMetrics fetches productivity feature metrics for the given parameters
func (s *SEIService) GetProductivityFeatureMetrics(ctx context.Context, accountID string, request *dto.ProductivityFeatureRequest) (*dto.ProductivityFeatureResponse, error) {
	path := seiProductivityFeatureMetricsPath

	// These endpoints expect the account in the session, not as a query param
	// So we'll use headers instead
	headers := map[string]string{
		"accountIdentifier": accountID,
	}

	// Convert request to JSON
	requestBody, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	productivityMetrics := new(dto.ProductivityFeatureResponse)
	err = s.Client.PostRaw(ctx, path, nil, bytes.NewReader(requestBody), headers, productivityMetrics)
	if err != nil {
		return nil, fmt.Errorf("failed to get productivity feature metrics: %w", err)
	}

	return productivityMetrics, nil
}

// GetProductivityFeatureBreakdown fetches productivity feature breakdown for the given parameters
func (s *SEIService) GetProductivityFeatureBreakdown(ctx context.Context, accountID string, request *dto.ProductivityFeatureRequest) (*dto.ProductivityFeatureBreakdownResponse, error) {
	path := seiProductivityFeatureBreakdownPath

	// These endpoints expect the account in the session, not as a query param
	// So we'll use headers instead
	headers := map[string]string{
		"accountIdentifier": accountID,
	}

	// Convert request to JSON
	requestBody, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	productivityBreakdown := new(dto.ProductivityFeatureBreakdownResponse)
	err = s.Client.PostRaw(ctx, path, nil, bytes.NewReader(requestBody), headers, productivityBreakdown)
	if err != nil {
		return nil, fmt.Errorf("failed to get productivity feature breakdown: %w", err)
	}

	return productivityBreakdown, nil
}

// GetProductivityFeatureDrilldown fetches productivity feature drilldown for the given parameters
func (s *SEIService) GetProductivityFeatureDrilldown(ctx context.Context, accountID string, request *dto.ProductivityFeatureRequest) (*dto.ProductivityFeatureDrilldownResponse, error) {
	path := seiProductivityFeatureDrilldownPath

	// These endpoints expect the account in the session, not as a query param
	// So we'll use headers instead
	headers := map[string]string{
		"accountIdentifier": accountID,
	}

	// Convert request to JSON
	requestBody, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	productivityDrilldown := new(dto.ProductivityFeatureDrilldownResponse)
	err = s.Client.PostRaw(ctx, path, nil, bytes.NewReader(requestBody), headers, productivityDrilldown)
	if err != nil {
		return nil, fmt.Errorf("failed to get productivity feature drilldown: %w", err)
	}

	return productivityDrilldown, nil
}

// GetProductivityFeatureIndividualDrilldown fetches productivity feature drilldown for an individual user
func (s *SEIService) GetProductivityFeatureIndividualDrilldown(ctx context.Context, accountID string, request *dto.ProductivityFeatureRequest) (*dto.ProductivityFeatureIndividualDrilldownResponse, error) {
	path := seiProductivityFeatureDrilldownIndPath

	// These endpoints expect the account in the session, not as a query param
	// So we'll use headers instead
	headers := map[string]string{
		"accountIdentifier": accountID,
	}

	// Convert request to JSON
	requestBody, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	individualDrilldown := new(dto.ProductivityFeatureIndividualDrilldownResponse)
	err = s.Client.PostRaw(ctx, path, nil, bytes.NewReader(requestBody), headers, individualDrilldown)
	if err != nil {
		return nil, fmt.Errorf("failed to get productivity feature individual drilldown: %w", err)
	}

	return individualDrilldown, nil
}
