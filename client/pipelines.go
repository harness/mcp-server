package client

import (
	"context"
	"fmt"

	"github.com/harness/harness-mcp/client/dto"
)

const (
	// Base API paths
	pipelinePath                 = "api/pipelines/%s"
	pipelineListPath             = "api/pipelines/list"
	pipelineExecutionPath        = "api/pipelines/execution/url"
	pipelineExecutionGetPath     = "api/pipelines/execution/v2/%s"
	pipelineExecutionSummaryPath = "api/pipelines/execution/summary"

	// Prefix to prepend for external API calls
	externalPathPrefix = "pipeline/"
)

type PipelineService struct {
	Client           *Client
	UseInternalPaths bool
}

func (p *PipelineService) buildPath(basePath string) string {
	if p.UseInternalPaths {
		return basePath
	}
	return externalPathPrefix + basePath
}

func (p *PipelineService) Get(ctx context.Context, scope dto.Scope, pipelineID string) (
	*dto.Entity[dto.PipelineData],
	error,
) {
	pathTemplate := p.buildPath(pipelinePath)
	path := fmt.Sprintf(pathTemplate, pipelineID)

	// Prepare query parameters
	params := make(map[string]string)
	addScope(scope, params)

	// Initialize the response object
	response := &dto.Entity[dto.PipelineData]{}

	// Make the GET request
	err := p.Client.Get(ctx, path, params, map[string]string{}, response)
	if err != nil {
		return nil, err
	}

	return response, nil
}

func (p *PipelineService) List(
	ctx context.Context,
	scope dto.Scope,
	opts *dto.PipelineListOptions,
) (*dto.ListOutput[dto.PipelineListItem], error) {
	path := p.buildPath(pipelineListPath)
	// Prepare query parameters
	params := make(map[string]string)
	addScope(scope, params)

	// Handle nil options by creating default options
	if opts == nil {
		opts = &dto.PipelineListOptions{}
	}

	// Set default pagination
	setDefaultPagination(&opts.PaginationOptions)

	// Add pagination parameters
	params["page"] = fmt.Sprintf("%d", opts.Page)
	params["size"] = fmt.Sprintf("%d", opts.Size)

	// Add optional parameters if provided
	if opts.SearchTerm != "" {
		params["searchTerm"] = opts.SearchTerm
	}

	// Create request body - this is required
	requestBody := map[string]string{
		"filterType": "PipelineSetup",
	}

	// Initialize the response object
	response := &dto.ListOutput[dto.PipelineListItem]{}

	// Make the POST request
	err := p.Client.Post(ctx, path, params, requestBody, response)
	if err != nil {
		return nil, err
	}

	return response, nil
}

func (p *PipelineService) ListExecutions(
	ctx context.Context,
	scope dto.Scope,
	opts *dto.PipelineExecutionOptions,
) (*dto.ListOutput[dto.PipelineExecution], error) {
	path := p.buildPath(pipelineExecutionSummaryPath)
	// Prepare query parameters
	params := make(map[string]string)
	addScope(scope, params)

	// Handle nil options by creating default options
	if opts == nil {
		opts = &dto.PipelineExecutionOptions{}
	}

	// Set default pagination
	setDefaultPagination(&opts.PaginationOptions)

	// Add pagination parameters
	params["page"] = fmt.Sprintf("%d", opts.Page)
	params["size"] = fmt.Sprintf("%d", opts.Size)

	// Add optional parameters if provided
	if opts.SearchTerm != "" {
		params["searchTerm"] = opts.SearchTerm
	}
	if opts.PipelineIdentifier != "" {
		params["pipelineIdentifier"] = opts.PipelineIdentifier
	}
	if opts.Status != "" {
		params["status"] = opts.Status
	}
	if opts.Branch != "" {
		params["branch"] = opts.Branch
	}
	if opts.MyDeployments {
		params["myDeployments"] = "true"
	} else {
		params["showAllExecutions"] = "false"
	}

	// Create request body with filter type and tags if needed
	requestBody := map[string]interface{}{
		"filterType": "PipelineExecution",
	}
	// Initialize the response object
	response := &dto.ListOutput[dto.PipelineExecution]{}

	// Make the POST request
	err := p.Client.Post(ctx, path, params, requestBody, response)
	if err != nil {
		return nil, fmt.Errorf("failed to list pipeline executions: %w", err)
	}

	return response, nil
}

// GetExecution retrieves details of a specific pipeline execution
func (p *PipelineService) GetExecution(
	ctx context.Context,
	scope dto.Scope,
	planExecutionID string,
) (*dto.Entity[dto.PipelineExecution], error) {
	pathTemplate := p.buildPath(pipelineExecutionGetPath)
	path := fmt.Sprintf(pathTemplate, planExecutionID)

	// Prepare query parameters
	params := make(map[string]string)
	addScope(scope, params)

	// Initialize the response object with the new structure that matches the API response
	response := &dto.Entity[dto.PipelineExecutionResponse]{}

	// Make the GET request
	err := p.Client.Get(ctx, path, params, map[string]string{}, response)
	if err != nil {
		return nil, fmt.Errorf("failed to get execution details: %w", err)
	}

	// Extract the execution details from the nested structure
	result := &dto.Entity[dto.PipelineExecution]{
		Status: response.Status,
		Data:   response.Data.PipelineExecutionSummary,
	}

	return result, nil
}

func (p *PipelineService) FetchExecutionURL(
	ctx context.Context,
	scope dto.Scope,
	pipelineID, planExecutionID string,
) (string, error) {
	path := p.buildPath(pipelineExecutionPath)

	// Prepare query parameters
	params := make(map[string]string)
	addScope(scope, params)
	params["pipelineIdentifier"] = pipelineID
	params["planExecutionId"] = planExecutionID

	// Initialize the response object
	urlResponse := &dto.Entity[string]{}

	// Make the POST request
	err := p.Client.Post(ctx, path, params, nil, urlResponse)
	if err != nil {
		return "", fmt.Errorf("failed to fetch execution URL: %w", err)
	}

	return urlResponse.Data, nil
}
