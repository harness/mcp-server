package client

import (
	"context"
	"fmt"

	"github.com/harness/harness-mcp/client/dto"
)

const (
	serviceListPath   = "/services"
	serviceGetPath    = "/services/%s"
	serviceCreatePath = "/services"
)

type ServiceClient struct {
	Client *Client
}

// Get retrieves a service by its identifier
// https://apidocs.harness.io/tag/Services#operation/getServiceV2
func (s *ServiceClient) Get(ctx context.Context, scope dto.Scope, serviceIdentifier string) (*dto.Service, error) {
	path := fmt.Sprintf(serviceGetPath, serviceIdentifier)
	params := make(map[string]string)
	// Ensure accountIdentifier is always set
	if scope.AccountID == "" {
		return nil, fmt.Errorf("accountIdentifier cannot be null")
	}
	addScope(ctx, scope, params)

	var response dto.ServiceResponse
	err := s.Client.Get(ctx, path, params, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to get service: %w", err)
	}

	return &response.Data, nil
}

// Create creates a new service
// https://apidocs.harness.io/tag/Services#operation/createServicesV2
func (s *ServiceClient) Create(ctx context.Context, scope dto.Scope, createReq *dto.CreateServiceRequest) (*dto.CreateServiceResponse, error) {
	path := serviceCreatePath
	params := make(map[string]string)

	// Ensure accountIdentifier is always set
	if scope.AccountID == "" {
		return nil, fmt.Errorf("accountIdentifier cannot be null")
	}
	addScope(ctx, scope, params)

	if createReq == nil {
		return nil, fmt.Errorf("create request cannot be nil")
	}

	response := &dto.CreateServiceResponse{}
	err := s.Client.Post(ctx, path, params, createReq, map[string]string{}, response)
	if err != nil {
		return nil, fmt.Errorf("failed to create service: %w", err)
	}

	return response, nil
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
	path := serviceListPath
	params := make(map[string]string)
	// Ensure accountIdentifier is always set
	if scope.AccountID == "" {
		return nil, 0, fmt.Errorf("accountIdentifier cannot be null")
	}
	addScope(ctx, scope, params)

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
