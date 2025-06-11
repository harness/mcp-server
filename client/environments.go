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
	environmentMoveConfigsPath = environmentBasePath + "/move-configs"
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

// MoveConfigs moves configurations from one environment to another
// https://apidocs.harness.io/tag/Environments#operation/moveEnvironmentConfigs
func (e *EnvironmentClient) MoveConfigs(ctx context.Context, request *dto.MoveEnvironmentConfigsRequest) (bool, error) {
	path := environmentMoveConfigsPath
	params := make(map[string]string)

	var response dto.MoveEnvironmentConfigsResponse
	err := e.Client.Post(ctx, path, params, request, &response)
	if err != nil {
		return false, fmt.Errorf("failed to move environment configurations: %w", err)
	}

	return response.Data.Success, nil
}
