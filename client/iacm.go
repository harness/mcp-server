package client

import (
	"context"
	"fmt"

	"github.com/harness/harness-mcp/client/dto"
)

const (
	// Production API paths (org and project in URL path)
	iacmWorkspacesPathProd   = "/iacm/api/orgs/%s/projects/%s/workspaces"
	iacmWorkspaceGetPathProd = "/iacm/api/orgs/%s/projects/%s/workspaces/%s"
	iacmResourcesPathProd    = "/iacm/api/orgs/%s/projects/%s/workspaces/%s/resources"
	iacmResourceGetPathProd  = "/iacm/api/orgs/%s/projects/%s/workspaces/%s/resources/%s"
	iacmModulesPathProd      = "/iacm/api/modules"
	iacmModuleGetPathProd    = "/iacm/api/modules/%s"

	// V1 Spec API paths (org and project as query params)
	iacmWorkspacesPathV1   = "/iacm/api/v1/workspaces"
	iacmWorkspaceGetPathV1 = "/iacm/api/v1/workspaces/%s"
	iacmResourcesPathV1    = "/iacm/api/v1/workspaces/%s/resources"
	iacmResourceGetPathV1  = "/iacm/api/v1/workspaces/%s/resources/%s"
	iacmModulesPathV1      = "/iacm/api/v1/modules"
	iacmModuleGetPathV1    = "/iacm/api/v1/modules/%s"
)

type IacmService struct {
	Client     *Client
	UseV1Paths bool // If true, use v1 spec paths; if false, use production paths
}

// ListWorkspaces lists all workspaces with optional filtering and pagination
func (i *IacmService) ListWorkspaces(
	ctx context.Context,
	scope dto.Scope,
	opts *dto.WorkspaceListOptions,
) (*dto.ListOutput[dto.Workspace], error) {
	var path string
	if i.UseV1Paths {
		// V1 spec path: /iacm/api/v1/workspaces
		path = iacmWorkspacesPathV1
	} else {
		// Production path: /iacm/api/orgs/{org}/projects/{project}/workspaces
		path = fmt.Sprintf(iacmWorkspacesPathProd, scope.OrgID, scope.ProjectID)
	}

	// Prepare query parameters
	params := make(map[string]string)
	params["accountIdentifier"] = scope.AccountID

	// For V1 paths, add org and project as query params
	if i.UseV1Paths {
		params["orgIdentifier"] = scope.OrgID
		params["projectIdentifier"] = scope.ProjectID
	}

	// Handle nil options by creating default options
	if opts == nil {
		opts = &dto.WorkspaceListOptions{}
	}

	// Set default pagination
	setDefaultPagination(&opts.PaginationOptions)
	// Production uses 1-based pagination, V1 spec uses 0-based
	if !i.UseV1Paths && opts.Page == 0 {
		opts.Page = 1
	}

	// Add pagination parameters
	params["page"] = fmt.Sprintf("%d", opts.Page)
	params["size"] = fmt.Sprintf("%d", opts.Size)

	// Add optional filter parameters if provided
	if opts.Status != "" {
		params["status"] = opts.Status
	}

	// Initialize the response object (IaCM returns array directly, not wrapped)
	var workspaces []dto.Workspace

	// Make the GET request
	err := i.Client.Get(ctx, path, params, map[string]string{}, &workspaces)
	if err != nil {
		return nil, err
	}

	// Wrap in ListOutput for consistency with other Harness APIs
	response := &dto.ListOutput[dto.Workspace]{
		Status: "SUCCESS",
		Data: dto.ListOutputData[dto.Workspace]{
			Content:    workspaces,
			TotalItems: len(workspaces),
		},
	}

	return response, nil
}

// GetWorkspace retrieves a specific workspace by ID
func (i *IacmService) GetWorkspace(
	ctx context.Context,
	scope dto.Scope,
	workspaceID string,
) (*dto.Entity[dto.Workspace], error) {
	var path string
	if i.UseV1Paths {
		// V1 spec path: /iacm/api/v1/workspaces/{id}
		path = fmt.Sprintf(iacmWorkspaceGetPathV1, workspaceID)
	} else {
		// Production path: /iacm/api/orgs/{org}/projects/{project}/workspaces/{identifier}
		path = fmt.Sprintf(iacmWorkspaceGetPathProd, scope.OrgID, scope.ProjectID, workspaceID)
	}

	// Prepare query parameters
	params := make(map[string]string)
	params["accountIdentifier"] = scope.AccountID

	// For V1 paths, add org and project as query params
	if i.UseV1Paths {
		params["orgIdentifier"] = scope.OrgID
		params["projectIdentifier"] = scope.ProjectID
	}

	// Initialize the response object (IaCM returns workspace directly)
	var workspace dto.Workspace

	// Make the GET request
	err := i.Client.Get(ctx, path, params, map[string]string{}, &workspace)
	if err != nil {
		return nil, err
	}

	// Wrap in Entity for consistency
	response := &dto.Entity[dto.Workspace]{
		Status: "SUCCESS",
		Data:   workspace,
	}

	return response, nil
}

// ListResources lists all resources in a workspace with optional filtering
func (i *IacmService) ListResources(
	ctx context.Context,
	scope dto.Scope,
	workspaceID string,
	opts *dto.ResourceListOptions,
) (*dto.ListOutput[dto.Resource], error) {
	var path string
	if i.UseV1Paths {
		// V1 spec path: /iacm/api/v1/workspaces/{id}/resources
		path = fmt.Sprintf(iacmResourcesPathV1, workspaceID)
	} else {
		// Production path: /iacm/api/orgs/{org}/projects/{project}/workspaces/{identifier}/resources
		path = fmt.Sprintf(iacmResourcesPathProd, scope.OrgID, scope.ProjectID, workspaceID)
	}

	// Prepare query parameters
	params := make(map[string]string)
	params["accountIdentifier"] = scope.AccountID

	// For V1 paths, add org and project as query params
	if i.UseV1Paths {
		params["orgIdentifier"] = scope.OrgID
		params["projectIdentifier"] = scope.ProjectID
	}

	// Handle nil options
	if opts == nil {
		opts = &dto.ResourceListOptions{}
	}

	// Set default pagination
	setDefaultPagination(&opts.PaginationOptions)
	// Production uses 1-based pagination, V1 spec uses 0-based
	if !i.UseV1Paths && opts.Page == 0 {
		opts.Page = 1
	}

	// Add pagination parameters
	params["page"] = fmt.Sprintf("%d", opts.Page)
	params["size"] = fmt.Sprintf("%d", opts.Size)

	// Add optional filter parameters
	if opts.Provider != "" {
		params["provider"] = opts.Provider
	}
	if opts.Type != "" {
		params["type"] = opts.Type
	}
	if opts.Module != "" {
		params["module"] = opts.Module
	}

	// Initialize the response object (IaCM returns array directly)
	var resources []dto.Resource

	// Make the GET request
	err := i.Client.Get(ctx, path, params, map[string]string{}, &resources)
	if err != nil {
		return nil, err
	}

	// Wrap in ListOutput for consistency
	response := &dto.ListOutput[dto.Resource]{
		Status: "SUCCESS",
		Data: dto.ListOutputData[dto.Resource]{
			Content:    resources,
			TotalItems: len(resources),
		},
	}

	return response, nil
}

// GetResource retrieves a specific resource by ID
func (i *IacmService) GetResource(
	ctx context.Context,
	scope dto.Scope,
	workspaceID string,
	resourceID string,
) (*dto.Entity[dto.Resource], error) {
	var path string
	if i.UseV1Paths {
		// V1 spec path: /iacm/api/v1/workspaces/{id}/resources/{resourceId}
		path = fmt.Sprintf(iacmResourceGetPathV1, workspaceID, resourceID)
	} else {
		// Production path: /iacm/api/orgs/{org}/projects/{project}/workspaces/{identifier}/resources/{resourceId}
		path = fmt.Sprintf(iacmResourceGetPathProd, scope.OrgID, scope.ProjectID, workspaceID, resourceID)
	}

	// Prepare query parameters
	params := make(map[string]string)
	params["accountIdentifier"] = scope.AccountID

	// For V1 paths, add org and project as query params
	if i.UseV1Paths {
		params["orgIdentifier"] = scope.OrgID
		params["projectIdentifier"] = scope.ProjectID
	}

	// Initialize the response object (IaCM returns resource directly)
	var resource dto.Resource

	// Make the GET request
	err := i.Client.Get(ctx, path, params, map[string]string{}, &resource)
	if err != nil {
		return nil, err
	}

	// Wrap in Entity for consistency
	response := &dto.Entity[dto.Resource]{
		Status: "SUCCESS",
		Data:   resource,
	}

	return response, nil
}

// ListModules lists all modules in the registry with optional filtering
func (i *IacmService) ListModules(
	ctx context.Context,
	scope dto.Scope,
	opts *dto.ModuleListOptions,
) (*dto.ListOutput[dto.Module], error) {
	var path string
	if i.UseV1Paths {
		// V1 spec path: /iacm/api/v1/modules
		path = iacmModulesPathV1
	} else {
		// Production path: /iacm/api/modules
		path = iacmModulesPathProd
	}

	// Prepare query parameters
	params := make(map[string]string)
	params["accountIdentifier"] = scope.AccountID

	// Handle nil options
	if opts == nil {
		opts = &dto.ModuleListOptions{}
	}

	// Set default pagination
	setDefaultPagination(&opts.PaginationOptions)
	// Production uses 1-based pagination, V1 spec uses 0-based
	if !i.UseV1Paths && opts.Page == 0 {
		opts.Page = 1
	}

	// Add pagination parameters
	params["page"] = fmt.Sprintf("%d", opts.Page)
	params["size"] = fmt.Sprintf("%d", opts.Size)

	// Add optional filter parameters
	if opts.Tag != "" {
		params["tag"] = opts.Tag
	}
	if opts.Version != "" {
		params["version"] = opts.Version
	}
	if opts.Provider != "" {
		params["provider"] = opts.Provider
	}

	// Initialize the response object (IaCM returns array directly)
	var modules []dto.Module

	// Make the GET request
	err := i.Client.Get(ctx, path, params, map[string]string{}, &modules)
	if err != nil {
		return nil, err
	}

	// Wrap in ListOutput for consistency
	response := &dto.ListOutput[dto.Module]{
		Status: "SUCCESS",
		Data: dto.ListOutputData[dto.Module]{
			Content:    modules,
			TotalItems: len(modules),
		},
	}

	return response, nil
}

// GetModule retrieves a specific module by ID
func (i *IacmService) GetModule(
	ctx context.Context,
	scope dto.Scope,
	moduleID string,
) (*dto.Entity[dto.Module], error) {
	var path string
	if i.UseV1Paths {
		// V1 spec path: /iacm/api/v1/modules/{id}
		path = fmt.Sprintf(iacmModuleGetPathV1, moduleID)
	} else {
		// Production path: /iacm/api/modules/{id}
		path = fmt.Sprintf(iacmModuleGetPathProd, moduleID)
	}

	// Prepare query parameters
	params := make(map[string]string)
	params["accountIdentifier"] = scope.AccountID

	// Initialize the response object (IaCM returns module directly)
	var module dto.Module

	// Make the GET request
	err := i.Client.Get(ctx, path, params, map[string]string{}, &module)
	if err != nil {
		return nil, err
	}

	// Wrap in Entity for consistency
	response := &dto.Entity[dto.Module]{
		Status: "SUCCESS",
		Data:   module,
	}

	return response, nil
}
