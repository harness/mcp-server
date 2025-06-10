package client

import (
	"context"
	"fmt"

	"github.com/harness/harness-mcp/client/dto"
)

const (
	infrastructureBasePath       = "ng/api/infrastructures"
	infrastructureListPath       = infrastructureBasePath
	infrastructureMoveConfigsPath = infrastructureBasePath + "/move-configs"
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
	if opts.Type != "" {
		params["type"] = opts.Type
	}
	if opts.Deployment != "" {
		params["deployment"] = opts.Deployment
	}
	if opts.Environment != "" {
		params["environment"] = opts.Environment
	}

	var response dto.InfrastructureListResponse
	err := i.Client.Get(ctx, path, params, nil, &response)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list infrastructures: %w", err)
	}

	return response.Data.Content, response.Data.TotalElements, nil
}

// MoveConfigs moves configurations from one infrastructure to another
// https://apidocs.harness.io/tag/Infrastructures#operation/moveInfraConfigs
func (i *InfrastructureClient) MoveConfigs(ctx context.Context, request *dto.MoveInfraConfigsRequest) (bool, error) {
	path := infrastructureMoveConfigsPath
	params := make(map[string]string)

	var response dto.MoveInfraConfigsResponse
	err := i.Client.Post(ctx, path, params, request, &response)
	if err != nil {
		return false, fmt.Errorf("failed to move infrastructure configurations: %w", err)
	}

	return response.Data.Success, nil
}
