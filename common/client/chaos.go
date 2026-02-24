package client

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/harness/mcp-server/common/client/dto"
)

const (
	// Base API paths
	chaosListExperimentsPath          = "rest/v2/experiment"
	chaosGetExperimentPath            = "rest/v2/experiments/%s"
	chaosGetExperimentRunPipelinePath = "rest/v2/chaos-pipeline/%s"
	chaosExperimentRunPath            = "rest/v2/experiments/%s/run"
	chaosListProbesPath               = "rest/v2/probes"
	chaosGetProbePath                 = "rest/v2/probes/%s"
	chaosCreateExperimentFromTemplate = "rest/experimenttemplates/%s/launch"
	chaosListExperimentTemplates      = "rest/experimenttemplates"
	chaosListExperimentVariables      = "rest/v2/experiments/%s/variables"
)

type ChaosService struct {
	Client *Client
}

func (c *ChaosService) ListExperiments(ctx context.Context, scope dto.Scope, pagination *dto.PaginationOptions) (*dto.ListExperimentResponse, error) {
	var (
		path   = chaosListExperimentsPath
		params = make(map[string]string)
	)

	// Set default pagination
	setDefaultPagination(pagination)

	// Add pagination parameters
	params["page"] = fmt.Sprintf("%d", pagination.Page)
	params["limit"] = fmt.Sprintf("%d", pagination.Size)
	// Add scope parameters
	params = addIdentifierParams(params, scope)

	listExperiments := new(dto.ListExperimentResponse)
	err := c.Client.Get(ctx, path, params, nil, listExperiments)
	if err != nil {
		return nil, fmt.Errorf("failed to list experiments: %w", err)
	}

	return listExperiments, nil
}

func (c *ChaosService) GetExperiment(ctx context.Context, scope dto.Scope, experimentID string) (*dto.GetExperimentResponse, error) {
	var (
		path   = fmt.Sprintf(chaosGetExperimentPath, experimentID)
		params = make(map[string]string)
	)

	// Add scope parameters
	params = addIdentifierParams(params, scope)

	getExperiment := new(dto.GetExperimentResponse)
	err := c.Client.Get(ctx, path, params, nil, getExperiment)
	if err != nil {
		return nil, fmt.Errorf("failed to get experiment: %w", err)
	}

	return getExperiment, nil
}

func (c *ChaosService) GetExperimentRun(ctx context.Context, scope dto.Scope, experimentID, experimentRunID string) (*dto.ChaosExecutionResponse, error) {
	var (
		path   = fmt.Sprintf(chaosGetExperimentRunPipelinePath, experimentID)
		params = make(map[string]string)
	)

	params["experimentRunId"] = experimentRunID
	// Add scope parameters
	params = addIdentifierParams(params, scope)

	getExperimentRun := new(dto.ChaosExecutionResponse)
	err := c.Client.Get(ctx, path, params, nil, getExperimentRun)
	if err != nil {
		return nil, fmt.Errorf("failed to get experiment run: %w", err)
	}

	return getExperimentRun, nil
}

func (c *ChaosService) RunExperiment(ctx context.Context, scope dto.Scope, experimentID string, request *dto.ExperimentRunRequest) (*dto.RunChaosExperimentResponse, error) {
	var (
		path   = fmt.Sprintf(chaosExperimentRunPath, experimentID)
		params = make(map[string]string)
	)

	// Add scope parameters
	params["isIdentity"] = "false"
	params = addIdentifierParams(params, scope)

	experimentRun := new(dto.RunChaosExperimentResponse)
	err := c.Client.Post(ctx, path, params, request, nil, experimentRun)
	if err != nil {
		return nil, fmt.Errorf("failed to run experiment: %w", err)
	}

	return experimentRun, nil
}

func (c *ChaosService) ListProbes(ctx context.Context, scope dto.Scope, pagination *dto.PaginationOptions) (*dto.ListProbeResponse, error) {
	var (
		path   = chaosListProbesPath
		params = make(map[string]string)
	)

	// Set default pagination
	setDefaultPagination(pagination)

	// Add pagination parameters
	params["page"] = fmt.Sprintf("%d", pagination.Page)
	params["limit"] = fmt.Sprintf("%d", pagination.Size)
	// Add scope parameters
	params = addIdentifierParams(params, scope)

	listExperiments := new(dto.ListProbeResponse)
	err := c.Client.Get(ctx, path, params, nil, listExperiments)
	if err != nil {
		return nil, fmt.Errorf("failed to list probes: %w", err)
	}

	return listExperiments, nil
}

func (c *ChaosService) GetProbe(ctx context.Context, scope dto.Scope, probeID string) (*dto.GetProbeResponse, error) {
	var (
		path   = fmt.Sprintf(chaosGetProbePath, probeID)
		params = make(map[string]string)
	)

	// Add scope parameters
	params = addIdentifierParams(params, scope)

	getProbe := new(dto.GetProbeResponse)
	err := c.Client.Get(ctx, path, params, nil, getProbe)
	if err != nil {
		return nil, fmt.Errorf("failed to get probe: %w", err)
	}

	return getProbe, nil
}

func (c *ChaosService) ListExperimentTemplates(ctx context.Context, scope dto.Scope, pagination *dto.PaginationOptions, hubIdentity string, infrastructureType string) (*dto.ListExperimentTemplateResponse, error) {
	var (
		path   = chaosListExperimentTemplates
		params = make(map[string]string)
	)

	// Set default pagination
	setDefaultPagination(pagination)

	// Add pagination parameters
	params["page"] = fmt.Sprintf("%d", pagination.Page)
	params["limit"] = fmt.Sprintf("%d", pagination.Size)
	params["hubIdentity"] = hubIdentity
	params["correlationID"] = uuid.New().String()

	if infrastructureType != "" {
		params["infrastructureType"] = infrastructureType
	}
	// Add scope parameters
	params = addIdentifierParams(params, scope)

	listExperimentTemplates := new(dto.ListExperimentTemplateResponse)
	err := c.Client.Get(ctx, path, params, nil, listExperimentTemplates)
	if err != nil {
		return nil, fmt.Errorf("failed to list experiment templates: %w", err)
	}

	return listExperimentTemplates, nil
}

func (c *ChaosService) CreateExperimentFromTemplateRequest(ctx context.Context, scope dto.Scope, templateID, hubIdentity string, request dto.CreateExperimentFromTemplateRequest) (*dto.ExperimentCreationResponse, error) {
	var (
		path   = fmt.Sprintf(chaosCreateExperimentFromTemplate, templateID)
		params = make(map[string]string)
	)

	// Add scope parameters
	params = addIdentifierParams(params, scope)

	// Add hub parameters
	params["hubIdentity"] = hubIdentity

	var createExperimentFromTemplates = new(dto.ExperimentCreationResponse)

	err := c.Client.Post(ctx, path, params, request, nil, createExperimentFromTemplates)
	if err != nil {
		return nil, fmt.Errorf("failed to create experiment from template: %w", err)
	}

	return createExperimentFromTemplates, nil
}

func (c *ChaosService) ListExperimentVariables(ctx context.Context, scope dto.Scope, experimentID string) (*dto.ListExperimentVariables, error) {
	var (
		path   = fmt.Sprintf(chaosListExperimentVariables, experimentID)
		params = make(map[string]string)
	)

	// Add scope parameters
	params["isIdentity"] = "false"
	params = addIdentifierParams(params, scope)

	listExperimentVariables := new(dto.ListExperimentVariables)
	err := c.Client.Get(ctx, path, params, nil, listExperimentVariables)
	if err != nil {
		return nil, fmt.Errorf("failed to list experiment variables: %w", err)
	}

	return listExperimentVariables, nil
}

const (
	chaosListLinuxInfrastructuresPath = "rest/machine/infras"
)

// ListLinuxInfrastructures lists available Linux infrastructure (load runners).
// statusFilter controls the status filter: non-empty values filter by that status, empty string omits the filter.
func (c *ChaosService) ListLinuxInfrastructures(ctx context.Context, scope dto.Scope, statusFilter string) (*dto.ListLinuxInfraResponse, error) {
	var (
		path   = chaosListLinuxInfrastructuresPath
		params = make(map[string]string)
	)

	// Add scope parameters
	params = addIdentifierParams(params, scope)
	params["infraType"] = "Linux"
	params["page"] = "0"
	params["limit"] = "15"

	filter := map[string]any{}
	if statusFilter != "" {
		filter["status"] = statusFilter
	}

	body := map[string]any{
		"filter": filter,
		"sort": map[string]any{
			"field":     "NAME",
			"ascending": true,
		},
	}

	result := new(dto.ListLinuxInfraResponse)
	err := c.Client.Post(ctx, path, params, body, nil, result)
	if err != nil {
		return nil, fmt.Errorf("failed to list linux infras: %w", err)
	}

	return result, nil
}

func addIdentifierParams(params map[string]string, scope dto.Scope) map[string]string {
	params["accountIdentifier"] = scope.AccountID
	params["projectIdentifier"] = scope.ProjectID
	params["organizationIdentifier"] = scope.OrgID
	return params
}
