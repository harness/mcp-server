package client

import (
	"context"
	"fmt"
	"github.com/harness/harness-mcp/client/dto"
)

const (
	chaosBasePath             = "chaos/manager/api"
	chaosListExperimentsPath  = chaosBasePath + "/rest/v2/experiment?accountIdentifier=%s&projectIdentifier=%s&organizationIdentifier=%s"
	chaosGetExperimentPath    = chaosBasePath + "/rest/v2/experiments/%s?accountIdentifier=%s&projectIdentifier=%s&organizationIdentifier=%s"
	chaosGetExperimentRunPath = chaosBasePath + "/rest/v2/experiments/%s/run?accountIdentifier=%s&projectIdentifier=%s&organizationIdentifier=%s&experimentRunId=%s"
	chaosExperimentRunPath    = chaosBasePath + "/rest/v2/experiments/%s/run?accountIdentifier=%s&projectIdentifier=%s&organizationIdentifier=%s&isIdentity=false"
)

type ChaosService struct {
	Client *Client
}

func (c *ChaosService) ListExperiments(ctx context.Context, scope dto.Scope) (*dto.ListExperimentResponse, error) {
	path := fmt.Sprintf(chaosListExperimentsPath, scope.AccountID, scope.ProjectID, scope.OrgID)
	params := make(map[string]string)

	listExperiments := new(dto.ListExperimentResponse)
	err := c.Client.Get(ctx, path, params, nil, listExperiments)
	if err != nil {
		return nil, fmt.Errorf("failed to list experiments: %w", err)
	}

	return listExperiments, nil
}

func (c *ChaosService) GetExperiment(ctx context.Context, scope dto.Scope, experimentID string) (*dto.GetExperimentResponse, error) {
	path := fmt.Sprintf(chaosGetExperimentPath, experimentID, scope.AccountID, scope.ProjectID, scope.OrgID)
	params := make(map[string]string)

	getExperiment := new(dto.GetExperimentResponse)
	err := c.Client.Get(ctx, path, params, nil, getExperiment)
	if err != nil {
		return nil, fmt.Errorf("failed to get experiment: %w", err)
	}

	return getExperiment, nil
}

func (c *ChaosService) GetExperimentRun(ctx context.Context, scope dto.Scope, experimentID, experimentRunID string) (*dto.ChaosExperimentRun, error) {
	path := fmt.Sprintf(chaosGetExperimentRunPath, experimentID, scope.AccountID, scope.ProjectID, scope.OrgID, experimentRunID)
	params := make(map[string]string)

	getExperimentRun := new(dto.ChaosExperimentRun)
	err := c.Client.Get(ctx, path, params, nil, getExperimentRun)
	if err != nil {
		return nil, fmt.Errorf("failed to get experiment run: %w", err)
	}

	return getExperimentRun, nil
}

func (c *ChaosService) RunExperiment(ctx context.Context, scope dto.Scope, experimentID string) (*dto.RunChaosExperimentResponse, error) {
	path := fmt.Sprintf(chaosExperimentRunPath, experimentID, scope.AccountID, scope.ProjectID, scope.OrgID)
	params := make(map[string]string)

	experimentRun := new(dto.RunChaosExperimentResponse)
	err := c.Client.Post(ctx, path, params, nil, experimentRun)
	if err != nil {
		return nil, fmt.Errorf("failed to run experiment: %w", err)
	}

	return experimentRun, nil
}
