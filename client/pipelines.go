package client

import (
	"context"
	"fmt"
	"strconv"

	"github.com/harness/harness-mcp/client/dto"
)

const (
	pipelinePath                 = "/api/pipelines/%s"
	pipelineListPath             = "/api/pipelines/list"
	pipelineExecutionPath        = "/api/pipelines/execution/url"
	pipelineExecutionGetPath     = "/api/pipelines/execution/v2/%s"
	pipelineExecutionSummaryPath = "/api/pipelines/execution/summary"
	pipelineInputSetListPath     = "/api/inputSets"
	pipelineInputSetPath         = "/api/inputSets/%s"
	pipelineTriggersPath         = "/api/triggers"
	pipelineSummaryPath          = "/api/pipelines/summary/%s"
)

type PipelineService struct {
	Client *Client
}

func (p *PipelineService) Get(ctx context.Context, scope dto.Scope, pipelineID string) (
	*dto.Entity[dto.PipelineData],
	error,
) {
	path := fmt.Sprintf(pipelinePath, pipelineID)

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
	path := pipelineListPath
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
	err := p.Client.Post(ctx, path, params, requestBody, map[string]string{}, response)
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
	path := pipelineExecutionSummaryPath
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
	err := p.Client.Post(ctx, path, params, requestBody, map[string]string{}, response)
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
	path := fmt.Sprintf(pipelineExecutionGetPath, planExecutionID)

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
	path := pipelineExecutionPath

	// Prepare query parameters
	params := make(map[string]string)
	addScope(scope, params)
	params["pipelineIdentifier"] = pipelineID
	params["planExecutionId"] = planExecutionID

	// Initialize the response object
	urlResponse := &dto.Entity[string]{}

	// Make the POST request
	err := p.Client.Post(ctx, path, params, nil, map[string]string{}, urlResponse)
	if err != nil {
		return "", fmt.Errorf("failed to fetch execution URL: %w", err)
	}

	return urlResponse.Data, nil
}

func (p *PipelineService) ListInputSets(
	ctx context.Context,
	scope dto.Scope,
	opts *dto.InputSetListOptions,
) (*dto.InputSetListResponse, error) {
	path := pipelineInputSetListPath

	// Prepare query parameters
	params := make(map[string]string)
	addScope(scope, params)

	// Handle nil options by creating default options
	if opts == nil {
		opts = &dto.InputSetListOptions{}
	}

	// Set default pagination
	setDefaultPagination(&opts.PaginationOptions)

	// Add pagination parameters
	params["page"] = fmt.Sprintf("%d", opts.Page)
	params["size"] = fmt.Sprintf("%d", opts.Size)

	// Add optional parameters if provided
	if opts.PipelineIdentifier != "" {
		params["pipelineIdentifier"] = opts.PipelineIdentifier
	}
	if opts.SearchTerm != "" {
		params["searchTerm"] = opts.SearchTerm
	}

	// Initialize the response object
	response := &dto.InputSetListResponse{}

	// Make the GET request
	err := p.Client.Get(ctx, path, params, map[string]string{}, response)
	if err != nil {
		return nil, fmt.Errorf("failed to list input sets: %w", err)
	}

	return response, nil
}

func (p *PipelineService) GetInputSet(
	ctx context.Context,
	scope dto.Scope,
	pipelineIdentifier, inputSetIdentifier string,
) (*dto.InputSetResponse, error) {
	pathTemplate := pipelineInputSetPath
	path := fmt.Sprintf(pathTemplate, inputSetIdentifier)

	// Prepare query parameters
	params := make(map[string]string)
	addScope(scope, params)
	params["pipelineIdentifier"] = pipelineIdentifier

	// Initialize the response object
	response := &dto.InputSetResponse{}

	// Make the GET request
	err := p.Client.Get(ctx, path, params, map[string]string{}, response)
	if err != nil {
		return nil, fmt.Errorf("failed to get input set: %w", err)
	}

	return response, nil
}

func (p *PipelineService) ListTriggers(
	ctx context.Context,
	scope dto.Scope,
	opts *dto.TriggerListOptions,
) (*dto.ListOutput[dto.TriggerListItem], error) {
	path := pipelineTriggersPath

	// Prepare query parameters
	params := make(map[string]string)
	addScope(scope, params)

	// Handle nil options by creating default options
	if opts == nil {
		opts = &dto.TriggerListOptions{}
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
	if opts.TargetIdentifier != "" {
		params["targetIdentifier"] = opts.TargetIdentifier
	}
	if opts.Filter != "" {
		params["filter"] = opts.Filter
	}

	// Add required parameters for the gateway endpoint based on the curl command
	params["accountIdentifier"] = scope.AccountID
	params["orgIdentifier"] = scope.OrgID
	params["projectIdentifier"] = scope.ProjectID

	// Initialize the response object
	response := &dto.ListOutput[dto.TriggerListItem]{}

	// Make the GET request (the API uses GET for this list operation)
	err := p.Client.Get(ctx, path, params, map[string]string{}, response)
	if err != nil {
		return nil, fmt.Errorf("failed to list triggers: %w", err)
	}

	return response, nil
}

// GetPipelineSummary gets a summary of a pipeline
func (p *PipelineService) GetPipelineSummary(
	ctx context.Context,
	scope dto.Scope,
	pipelineIdentifier string,
	getMetadataOnly bool,
) (*dto.Entity[dto.PipelineSummary], error) {
	// Format the pipeline path first to replace its %s placeholder
	path := fmt.Sprintf(pipelineSummaryPath, pipelineIdentifier)

	// Prepare query parameters
	params := make(map[string]string)
	addScope(scope, params)

	// Add the getMetadataOnly parameter
	params["getMetadataOnly"] = strconv.FormatBool(getMetadataOnly)

	// Add required parameters for the endpoint
	params["accountIdentifier"] = scope.AccountID
	params["orgIdentifier"] = scope.OrgID
	params["projectIdentifier"] = scope.ProjectID

	var responseData dto.Entity[dto.PipelineSummary]
	err := p.Client.Get(ctx, path, params, map[string]string{}, &responseData)
	if err != nil {
		return nil, fmt.Errorf("failed to get pipeline summary: %w", err)
	}

	return &responseData, nil
}
