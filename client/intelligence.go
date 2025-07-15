package client

import (
	"context"
	"fmt"

	"github.com/harness/harness-mcp/client/dto"
)

const (
	// Base API paths
	similaritySearchPath = "api/v1/template-search"
)

type IntelligenceService struct {
	Client *Client
}

func (ts *IntelligenceService) buildPath(basePath string) string {
	return basePath
}

// SimilaritySearch searches for similar templates based on the provided request
func (ts *IntelligenceService) SimilaritySearch(ctx context.Context, request *dto.SimilaritySearchRequest) (*dto.SimilaritySearchResponse, error) {
	endpoint := ts.buildPath(similaritySearchPath)

	// Validate required parameters
	if request.AccountID == "" {
		return nil, fmt.Errorf("account_identifier is required")
	}
	if request.Description == "" {
		return nil, fmt.Errorf("description is required")
	}

	// Create query parameters map for all request fields
	params := make(map[string]string)
	params["account_identifier"] = request.AccountID

	if request.OrgID != "" {
		params["org_identifier"] = request.OrgID
	}
	if request.ProjectID != "" {
		params["project_identifier"] = request.ProjectID
	}

	// Always include description as it's required
	params["description"] = request.Description

	// Include optional parameters
	if request.TemplateType != "" {
		params["template_type"] = request.TemplateType
	}
	if request.Count > 0 {
		params["count"] = fmt.Sprintf("%d", request.Count)
	}

	var result dto.SimilaritySearchResponse
	err := ts.Client.Get(ctx, endpoint, params, map[string]string{}, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to perform similarity search: %w", err)
	}

	return &result, nil
}
