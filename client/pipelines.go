package client

import (
	"context"
	"fmt"
	"log/slog"
	"strconv"
	"strings"

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
	addScope(ctx, scope, params)

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
	addScope(ctx, scope, params)

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
	addScope(ctx, scope, params)

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

// PipelineExecutionResult contains the pipeline execution details and log keys
type PipelineExecutionResult struct {
	Execution dto.PipelineExecution `json:"execution,omitempty"`
	LogKeys   dto.FinalLogKeys      `json:"logKeys,omitempty"`
}

// GetExecutionWithLogKeys retrieves details of a specific pipeline execution along with log keys
func (p *PipelineService) GetExecutionWithLogKeys(
	ctx context.Context,
	scope dto.Scope,
	planExecutionID string,
	stageNodeID string,
	childStageNodeID string,
) (*dto.Entity[PipelineExecutionResult], error) {
	path := fmt.Sprintf(pipelineExecutionGetPath, planExecutionID)

	// Prepare query parameters
	params := make(map[string]string)
	addScope(ctx, scope, params)

	// Add stageNodeId if provided
	if stageNodeID != "" {
		params["stageNodeId"] = stageNodeID
	}

	// Add childStageNodeId if provided
	if childStageNodeID != "" {
		params["childStageNodeId"] = childStageNodeID
	}

	slog.InfoContext(ctx, "Fetching execution details with log keys", "planExecutionID", planExecutionID, "stageNodeID", stageNodeID, "childStageNodeID", childStageNodeID)
	// Initialize the response object with the new structure that matches the API response
	response := &dto.Entity[dto.PipelineExecutionResponse]{}

	// Make the GET request
	err := p.Client.Get(ctx, path, params, map[string]string{}, response)
	if err != nil {
		return nil, fmt.Errorf("failed to get execution details: %w", err)
	}
	// Extract log keys from the execution graph
	logKeys := extractLogKeys(response.Data)

	// Create the result with both execution details and log keys
	result := &dto.Entity[PipelineExecutionResult]{
		Status: response.Status,
		Data: PipelineExecutionResult{
			Execution: response.Data.PipelineExecutionSummary,
			LogKeys:   logKeys,
		},
	}
	slog.InfoContext(ctx, "Returning execution result with child graph", "childGraphExists", response.Data.ChildGraph.ExecutionGraph.NodeMap != nil, "childPipelineId", response.Data.ChildGraph.PipelineExecutionSummary.PipelineIdentifier)
	return result, nil
}

// extractLogKeys extracts log keys from the execution graph
func extractLogKeys(executionResponse dto.PipelineExecutionResponse) dto.FinalLogKeys {
	logKeys := dto.FinalLogKeys{
		StepLogBaseKeys: []string{},
	}

	// Process the main execution graph
	if executionResponse.ExecutionGraph.NodeMap != nil {
		processExecutionGraph(executionResponse.ExecutionGraph, &logKeys)
	}

	// Process child graphs if they exist
	if executionResponse.ChildGraph.ExecutionGraph.NodeMap != nil {
		processExecutionGraph(executionResponse.ChildGraph.ExecutionGraph, &logKeys)
	}

	return logKeys
}

// processExecutionGraph processes an execution graph to extract log keys
func processExecutionGraph(graph dto.ExecutionGraph, logKeys *dto.FinalLogKeys) {
	// Extract all log base keys for steps
	stepLogBaseKeys := extractLogBaseKeysForSteps(graph.NodeMap)

	// Store the step log base keys in the result
	logKeys.StepLogBaseKeys = append(logKeys.StepLogBaseKeys, stepLogBaseKeys...)
}

// extractLogBaseKeysForSteps extracts an array of logbasekeys where node.BaseFqn contains "steps"
func extractLogBaseKeysForSteps(nodes map[string]dto.ExecutionNode) []string {
	var logBaseKeys []string

	// Iterate through all nodes and find those containing "steps" in BaseFqn
	for _, node := range nodes {
		// Check if the BaseFqn contains "steps"
		if strings.Contains(node.BaseFqn, ".steps.") && node.LogBaseKey != "" {
			logBaseKeys = append(logBaseKeys, node.LogBaseKey)
		}
	}

	return logBaseKeys
}

func (p *PipelineService) FetchExecutionURL(
	ctx context.Context,
	scope dto.Scope,
	pipelineID, planExecutionID string,
) (string, error) {
	path := pipelineExecutionPath

	// Prepare query parameters
	params := make(map[string]string)
	addScope(ctx, scope, params)

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
	addScope(ctx, scope, params)

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
	addScope(ctx, scope, params)

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
	addScope(ctx, scope, params)

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
	addScope(ctx, scope, params)

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
