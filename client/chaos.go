package client

import (
	"context"
	"fmt"
	"github.com/harness/harness-mcp/client/dto"
)

const (
	// Base API paths
	chaosListExperimentsPath  = "api/rest/v2/experiment"
	chaosGetExperimentPath    = "api/rest/v2/experiments/%s"
	chaosGetExperimentRunPath = "api/rest/v2/experiments/%s/run"
	chaosExperimentRunPath    = "api/rest/v2/experiments/%s/run"

	// Prefix to prepend for external API calls
	externalChaosManagerPathPrefix = "chaos/manager/"
)

type ChaosService struct {
	Client           *Client
	UseInternalPaths bool
}

func (c *ChaosService) buildPath(basePath string) string {
	if c.UseInternalPaths {
		return basePath
	}
	return externalChaosManagerPathPrefix + basePath
}

func (c *ChaosService) ListExperiments(ctx context.Context, scope dto.Scope, pagination *dto.PaginationOptions) (*dto.ListExperimentResponse, error) {
	var (
		pathTemplate = c.buildPath(chaosListExperimentsPath)
		path         = fmt.Sprintf(pathTemplate)
		params       = make(map[string]string)
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
		pathTemplate = c.buildPath(chaosGetExperimentPath)
		path         = fmt.Sprintf(pathTemplate, experimentID)
		params       = make(map[string]string)
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

func (c *ChaosService) GetExperimentRun(ctx context.Context, scope dto.Scope, experimentID, experimentRunID string) (*dto.ChaosExperimentRun, error) {
	var (
		pathTemplate = c.buildPath(chaosGetExperimentRunPath)
		path         = fmt.Sprintf(pathTemplate, experimentID)
		params       = make(map[string]string)
	)

	params["experimentRunId"] = experimentRunID
	// Add scope parameters
	params = addIdentifierParams(params, scope)

	getExperimentRun := new(dto.ChaosExperimentRun)
	err := c.Client.Get(ctx, path, params, nil, getExperimentRun)
	if err != nil {
		return nil, fmt.Errorf("failed to get experiment run: %w", err)
	}

	return getExperimentRun, nil
}

func (c *ChaosService) RunExperiment(ctx context.Context, scope dto.Scope, experimentID string) (*dto.RunChaosExperimentResponse, error) {
	var (
		pathTemplate = c.buildPath(chaosExperimentRunPath)
		path         = fmt.Sprintf(pathTemplate, experimentID)
		params       = make(map[string]string)
	)

	// Add scope parameters
	params["isIdentity"] = "false"
	params = addIdentifierParams(params, scope)

	experimentRun := new(dto.RunChaosExperimentResponse)
	err := c.Client.Post(ctx, path, params, nil, experimentRun)
	if err != nil {
		return nil, fmt.Errorf("failed to run experiment: %w", err)
	}

	return experimentRun, nil
}

func addIdentifierParams(params map[string]string, scope dto.Scope) map[string]string {
	params["accountIdentifier"] = scope.AccountID
	params["projectIdentifier"] = scope.ProjectID
	params["organizationIdentifier"] = scope.OrgID
	return params
}
