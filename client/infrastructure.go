package client

import (
	"context"
	"fmt"

	"github.com/harness/harness-mcp/client/dto"
)

const (
	infrastructureBasePath        = "ng/api/infrastructures"
	infrastructureListPath        = infrastructureBasePath
	infrastructureMoveConfigsPath = infrastructureBasePath + "/move-config/%s"
)

type InfrastructureClient struct {
	Client *Client
}

// setDefaultPaginationForInfrastructure sets default pagination values for InfrastructureOptions
func setDefaultPaginationForInfrastructure(opts *dto.InfrastructureOptions) {
	if opts == nil {
		return
	}
	if opts.Page <= 0 {
		opts.Page = 0 // API uses 0-based indexing
	}

	if opts.Limit <= 0 {
		opts.Limit = defaultPageSize
	} else if opts.Limit > maxPageSize {
		opts.Limit = maxPageSize
	}
}

// List retrieves a list of infrastructures based on the provided options
// https://apidocs.harness.io/tag/Infrastructures#operation/getInfrastructureList
func (i *InfrastructureClient) List(ctx context.Context, scope dto.Scope, opts *dto.InfrastructureOptions) ([]dto.Infrastructure, int, error) {
	path := infrastructureListPath
	params := make(map[string]string)
	addScope(scope, params)

	// Handle nil options by creating default options
	if opts == nil {
		opts = &dto.InfrastructureOptions{}
	}

	setDefaultPaginationForInfrastructure(opts)

	params["page"] = fmt.Sprintf("%d", opts.Page)
	params["size"] = fmt.Sprintf("%d", opts.Limit)

	if opts.Sort != "" {
		params["sort"] = opts.Sort
	}
	if opts.Order != "" {
		params["order"] = opts.Order
	}
	if opts.DeploymentType != "" {
		params["deploymentType"] = opts.DeploymentType
	}
	if opts.EnvironmentIdentifier != "" {
		params["environmentIdentifier"] = opts.EnvironmentIdentifier
	}

	var response dto.InfrastructureListResponse
	err := i.Client.Get(ctx, path, params, nil, &response)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list infrastructures: %w", err)
	}

	// Convert the InfrastructureItem array to Infrastructure array
	infrastructures := make([]dto.Infrastructure, 0, len(response.Data.Content))
	for _, item := range response.Data.Content {
		infrastructures = append(infrastructures, item.Infrastructure)
	}

	return infrastructures, response.Data.TotalItems, nil
}

// MoveConfigs moves infrastructure YAML from inline to remote or vice versa
// https://apidocs.harness.io/tag/Infrastructures#operation/moveConfig
func (i *InfrastructureClient) MoveConfigs(ctx context.Context, scope dto.Scope, request *dto.MoveInfraConfigsRequest) (*dto.MoveInfraConfigsResponse, error) {
	path := fmt.Sprintf(infrastructureMoveConfigsPath, request.InfraIdentifier)
	params := make(map[string]string)
	// Add scope to parameters
	addScope(scope, params)

	// Add required parameters
	params["accountIdentifier"] = request.AccountIdentifier

	// Add optional parameters
	if request.EnvironmentIdentifier != "" {
		params["environmentIdentifier"] = request.EnvironmentIdentifier
	}

	if request.OrgIdentifier != "" {
		params["orgIdentifier"] = request.OrgIdentifier
	}

	if request.ProjectIdentifier != "" {
		params["projectIdentifier"] = request.ProjectIdentifier
	}

	if request.ConnectorRef != "" {
		params["connectorRef"] = request.ConnectorRef
	}

	if request.RepoName != "" {
		params["repoName"] = request.RepoName
	}

	if request.Branch != "" {
		params["branch"] = request.Branch
	}

	if request.FilePath != "" {
		params["filePath"] = request.FilePath
	}

	if request.CommitMsg != "" {
		params["commitMsg"] = request.CommitMsg
	}

	if request.IsNewBranch != nil {
		params["isNewBranch"] = fmt.Sprintf("%t", *request.IsNewBranch)
	}

	if request.BaseBranch != "" {
		params["baseBranch"] = request.BaseBranch
	}

	if request.IsHarnessCodeRepo != nil {
		params["isHarnessCodeRepo"] = fmt.Sprintf("%t", *request.IsHarnessCodeRepo)
	}

	// Ensure the parameter name matches exactly what the API expects
	params["moveConfigType"] = string(request.MoveConfigType)

	// No request body needed for this API
	response := &dto.MoveInfraConfigsResponse{}
	err := i.Client.Post(ctx, path, params, nil, response)
	if err != nil {
		return nil, fmt.Errorf("failed to move infrastructure configurations: %w", err)
	}

	return response, nil
}
