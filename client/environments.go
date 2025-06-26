package client

import (
	"context"
	"fmt"

	"github.com/harness/harness-mcp/client/dto"
)

const (
	environmentBasePath        = "ng/api/environments"
	environmentGetPath         = environmentBasePath + "/%s"
	environmentListPath        = environmentBasePath
	environmentMoveConfigsPath = environmentBasePath + "V2/move-config/%s"
)

type EnvironmentClient struct {
	Client *Client
}

// Get retrieves an environment by its identifier
// https://apidocs.harness.io/tag/Environments#operation/getEnvironmentV2
func (e *EnvironmentClient) Get(ctx context.Context, scope dto.Scope, environmentIdentifier string) (*dto.Environment, error) {
	path := fmt.Sprintf(environmentGetPath, environmentIdentifier)
	params := make(map[string]string)
	addScope(scope, params)

	var response dto.EnvironmentResponse
	err := e.Client.Get(ctx, path, params, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to get environment: %w", err)
	}

	return &response.Data, nil
}

// setDefaultPaginationForEnvironment sets default pagination values for EnvironmentOptions
func setDefaultPaginationForEnvironment(opts *dto.EnvironmentOptions) {
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

// List retrieves a list of environments based on the provided options
// https://apidocs.harness.io/tag/Environments#operation/getEnvironmentList
func (e *EnvironmentClient) List(ctx context.Context, scope dto.Scope, opts *dto.EnvironmentOptions) ([]dto.Environment, int, error) {
	path := environmentListPath
	params := make(map[string]string)
	addScope(scope, params)

	// Handle nil options by creating default options
	if opts == nil {
		opts = &dto.EnvironmentOptions{}
	}

	setDefaultPaginationForEnvironment(opts)

	params["page"] = fmt.Sprintf("%d", opts.Page)
	params["size"] = fmt.Sprintf("%d", opts.Limit)

	if opts.Sort != "" {
		params["sort"] = opts.Sort
	}
	if opts.Order != "" {
		params["order"] = opts.Order
	}

	var response dto.EnvironmentListResponse
	err := e.Client.Get(ctx, path, params, nil, &response)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list environments: %w", err)
	}

	return response.Data.Content, response.Data.TotalElements, nil
}

// MoveConfigs moves environment YAML from inline to remote
// https://apidocs.harness.io/tag/Environments#operation/moveEnvironmentConfig
// Note: REMOTE_TO_INLINE operations are not supported for environments
func (e *EnvironmentClient) MoveConfigs(ctx context.Context, scope dto.Scope, request *dto.MoveEnvironmentConfigsRequest) (bool, error) {
	path := fmt.Sprintf(environmentMoveConfigsPath, request.EnvironmentIdentifier)

	params := make(map[string]string)
	addScope(scope, params)

	// Explicitly add org and project identifiers from the request
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

	// Check that we're not attempting an unsupported operation
	if request.MoveConfigType == dto.RemoteToInline {
		return false, fmt.Errorf("operation not supported: REMOTE_TO_INLINE operation is not supported for environments")
	}

	// Ensure the parameter name matches exactly what the API expects
	params["moveConfigType"] = string(request.MoveConfigType)

	response := &dto.MoveEnvironmentConfigsResponse{}
	err := e.Client.Post(ctx, path, params, nil, response)
	if err != nil {
		return false, fmt.Errorf("failed to move environment configurations: %w", err)
	}

	return response.Data.Success, nil
}
