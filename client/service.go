package client

import (
	"context"
	"fmt"

	"github.com/harness/harness-mcp/client/dto"
)

const (
	extServiceBasePath   = "ng/api/services"
	intServiceBasePath   = "api/services"
	serviceGetPathSuffix = "/%s"
)

type ServiceClient struct {
	Client           *Client
	UseInternalPaths bool
}

// Get retrieves a service by its identifier
// https://apidocs.harness.io/tag/Services#operation/getServiceV2
func (s *ServiceClient) Get(ctx context.Context, scope dto.Scope, serviceIdentifier string) (*dto.Service, error) {
	basePath := extServiceBasePath
	if s.UseInternalPaths {
		basePath = intServiceBasePath
	}
	path := fmt.Sprintf(basePath+serviceGetPathSuffix, serviceIdentifier)
	params := make(map[string]string)
	// Ensure accountIdentifier is always set
	if scope.AccountID == "" {
		return nil, fmt.Errorf("accountIdentifier cannot be null")
	}
	addScope(scope, params)

	var response dto.ServiceResponse
	err := s.Client.Get(ctx, path, params, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to get service: %w", err)
	}

	return &response.Data, nil
}

// setDefaultPaginationForService sets default pagination values for ServiceOptions
func setDefaultPaginationForService(opts *dto.ServiceOptions) {
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

// List retrieves a list of services based on the provided options
// https://apidocs.harness.io/tag/Services#operation/getServiceList
func (s *ServiceClient) List(ctx context.Context, scope dto.Scope, opts *dto.ServiceOptions) ([]dto.Service, int, error) {
	path := extServiceBasePath
	if s.UseInternalPaths {
		path = intServiceBasePath
	}
	params := make(map[string]string)
	// Ensure accountIdentifier is always set
	if scope.AccountID == "" {
		return nil, 0, fmt.Errorf("accountIdentifier cannot be null")
	}
	addScope(scope, params)

	// Handle nil options by creating default options
	if opts == nil {
		opts = &dto.ServiceOptions{}
	}

	setDefaultPaginationForService(opts)

	params["page"] = fmt.Sprintf("%d", opts.Page)
	params["size"] = fmt.Sprintf("%d", opts.Limit)

	if opts.Sort != "" {
		params["sort"] = opts.Sort
	}
	if opts.Order != "" {
		params["order"] = opts.Order
	}

	var response dto.ServiceListResponse
	err := s.Client.Get(ctx, path, params, nil, &response)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list services: %w", err)
	}

	return response.Data.Content, response.Data.TotalElements, nil
}
