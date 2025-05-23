package client

import (
	"context"
	"fmt"

	"github.com/harness/harness-mcp/client/dto"
)

const (
	templateBasePath = "gateway/template/api/templates/%s"
	templateListPath = "gateway/template/api/templates/list-metadata"
)

type TemplateService struct {
	client *Client
}

func (t *TemplateService) Get(ctx context.Context, scope dto.Scope, templateID string) (
	*dto.Entity[dto.TemplateData],
	error,
) {
	path := fmt.Sprintf(templateBasePath, templateID)

	// Prepare query parameters
	params := make(map[string]string)
	addScope(scope, params)

	// Initialize the response object
	response := &dto.Entity[dto.TemplateData]{}

	// Make the GET request
	err := t.client.Get(ctx, path, params, map[string]string{}, response)
	if err != nil {
		return nil, fmt.Errorf("failed to get template: %w", err)
	}

	return response, nil
}

func (t *TemplateService) List(
	ctx context.Context,
	scope dto.Scope,
	opts *dto.TemplateListOptions,
) (*dto.ListOutput[dto.TemplateListItem], error) {
	// Prepare query parameters
	params := make(map[string]string)
	addScope(scope, params)

	// Handle nil options by creating default options
	if opts == nil {
		opts = &dto.TemplateListOptions{}
	}

	// Set default pagination
	setDefaultPagination(&opts.PaginationOptions)

	// Add pagination parameters
	params["page"] = fmt.Sprintf("%d", opts.Page)
	params["size"] = fmt.Sprintf("%d", opts.Size)
	
	// Set templateListType parameter with default if not provided
	if opts.TemplateListType != "" {
		params["templateListType"] = opts.TemplateListType
	} else {
		params["templateListType"] = "LastUpdated"
	}
	
	// Set sort parameter with default if not provided
	if opts.Sort != "" {
		params["sort"] = opts.Sort
	} else {
		params["sort"] = "lastUpdatedAt,DESC"
	}

	// Add optional parameters if provided
	if opts.SearchTerm != "" {
		params["searchTerm"] = opts.SearchTerm
	}

	// Create request body - this is required for templates
	requestBody := map[string]string{
		"filterType": "Template",
	}

	// Initialize the response object
	response := &dto.ListOutput[dto.TemplateListItem]{}

	// Make the POST request
	err := t.client.Post(ctx, templateListPath, params, requestBody, response)
	if err != nil {
		return nil, fmt.Errorf("failed to list templates: %w", err)
	}

	return response, nil
}