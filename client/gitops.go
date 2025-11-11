package client

import (
	"context"
	"fmt"

	"github.com/harness/harness-mcp/client/dto"
)

const (
	gitopsListApplicationsPath = "/api/v1/applications"
	gitopsGetApplicationPath   = "/api/v1/agents/%s/applications/%s"
)

// GitOpsService handles GitOps application operations
type GitOpsService struct {
	Client *Client
}

// setDefaultPaginationForGitOps sets default pagination values for GitOpsApplicationOptions
func setDefaultPaginationForGitOps(opts *dto.GitOpsApplicationOptions) {
	if opts == nil {
		return
	}
	if opts.Page <= 0 {
		opts.Page = 0 // API uses 0-based indexing
	}

	if opts.Size <= 0 {
		opts.Size = defaultPageSize
	} else if opts.Size > maxPageSize {
		opts.Size = maxPageSize
	}
}

// ListApplications retrieves a list of GitOps applications based on the provided options
// https://apidocs.harness.io/tag/Application#operation/ApplicationService_ListApps
func (g *GitOpsService) ListApplications(ctx context.Context, scope dto.Scope, opts *dto.GitOpsApplicationOptions) (*dto.GitOpsApplicationListResponse, error) {
	path := gitopsListApplicationsPath

	// Ensure accountIdentifier is always set
	if scope.AccountID == "" {
		return nil, fmt.Errorf("accountIdentifier cannot be null")
	}

	// Handle nil options by creating default options
	if opts == nil {
		opts = &dto.GitOpsApplicationOptions{}
	}

	setDefaultPaginationForGitOps(opts)

	// Build the request body following the servicev1ApplicationQuery schema
	requestBody := dto.GitOpsApplicationQueryRequest{
		AccountIdentifier: scope.AccountID,
		OrgIdentifier:     scope.OrgID,
		ProjectIdentifier: scope.ProjectID,
		SearchTerm:        opts.SearchTerm,
		PageSize:          opts.Size,
		PageIndex:         opts.Page,
		Filter:            opts.Filter,
		SortBy:            opts.SortBy,
		SortOrder:         opts.SortOrder,
		MetadataOnly:      opts.MetadataOnly,
		Fields:            opts.Fields,
	}

	var response dto.GitOpsApplicationListResponse
	err := g.Client.Post(ctx, path, nil, requestBody, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to list GitOps applications: %w", err)
	}

	return &response, nil
}

// GetApplication retrieves a specific GitOps application by name
// https://apidocs.harness.io/tag/Application#operation/AgentApplicationService_Get
func (g *GitOpsService) GetApplication(ctx context.Context, scope dto.Scope, agentIdentifier string, applicationName string, opts *dto.GitOpsGetApplicationOptions) (*dto.GitOpsApplication, error) {
	path := fmt.Sprintf(gitopsGetApplicationPath, agentIdentifier, applicationName)
	params := make(map[string]string)

	// Ensure accountIdentifier is always set
	if scope.AccountID == "" {
		return nil, fmt.Errorf("accountIdentifier cannot be null")
	}

	// Add scope parameters
	addScope(ctx, scope, params)

	// Handle nil options
	if opts == nil {
		opts = &dto.GitOpsGetApplicationOptions{}
	}

	// Add optional query parameters
	if opts.Refresh != "" {
		params["query.refresh"] = opts.Refresh
	}

	if len(opts.Project) > 0 {
		for _, project := range opts.Project {
			params["query.project"] = project // Note: Multiple values might need special handling
		}
	}

	if opts.ResourceVersion != "" {
		params["query.resourceVersion"] = opts.ResourceVersion
	}

	if opts.Selector != "" {
		params["query.selector"] = opts.Selector
	}

	if opts.Repo != "" {
		params["query.repo"] = opts.Repo
	}

	if opts.AppNamespace != "" {
		params["query.appNamespace"] = opts.AppNamespace
	}

	if opts.FetchFromHarness {
		params["fetchFromHarness"] = "true"
	}

	var response dto.GitOpsApplication
	err := g.Client.Get(ctx, path, params, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to get GitOps application: %w", err)
	}

	return &response, nil
}
