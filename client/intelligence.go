package client

import (
	"context"
	"fmt"		

	"github.com/harness/harness-mcp/client/dto"
)

const (
	// Base API paths
	similaritySearchPath = "api/v1/template-search"
	aiDevOpsAgentPath    = "api/v1/chat/platform"
)

type IntelligenceService struct {
	Client *Client
}

func (ts *IntelligenceService) buildPath(basePath string) string {
	return basePath
}

// SimilaritySearch searches for similar templates based on the provided request
func (ts *IntelligenceService) SimilaritySearch(ctx context.Context, request *dto.SimilaritySearchRequest) (*dto.TemplateData, error) {
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

	var templateRef string

	res := result.Results[0]
	// Check if metadata is an array of key-value pairs
	metadataArray, ok := res.Metadata.([]interface{})
	if !ok {
		return nil, fmt.Errorf("metadata is not an array of key-value pairs")
	}

	// Extract template_id, org_id, and project_id from metadata
	var templateID, orgID, projectID string
	for _, item := range metadataArray {
		kvPair, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		
		key, keyOk := kvPair["Key"].(string)
		value, valueOk := kvPair["Value"].(string)
		
		if !keyOk || !valueOk {
			continue
		}
		
		switch key {
		case "template_id":
			templateID = value
		case "org_id":
			orgID = value
		case "project_id":
			projectID = value
		}
	}
	
	// Skip if template_id is missing
	if templateID == "" {
		return nil, fmt.Errorf("template_id is missing")
	}
	
	// Build template reference based on scope
	templateRef = buildTemplateRef(orgID, projectID, templateID)
	templateData := dto.TemplateData("template_ref: " + templateRef + " type: " + request.TemplateType)
	
	return &templateData, nil
}

func buildTemplateRef(orgID, projectID, templateID string) string {
    if projectID != "" {
        return templateID
    } else if orgID != "" {
        return fmt.Sprintf("org.%s", templateID)
    } else {
        return fmt.Sprintf("account.%s", templateID)
    }
}