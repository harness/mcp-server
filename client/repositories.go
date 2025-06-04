package client

import (
	"context"
	"fmt"
	"net/url"
	"strings"

	"github.com/harness/harness-mcp/client/dto"
)

const (
	repositoryBasePath = "code/api/v1/repos"
	repositoryGetPath  = repositoryBasePath + "/%s"
	repositoryListPath = repositoryBasePath
	// Path for getting file content from a commit
	// Format: /code/api/v1/repos/{account}/{org}/{project}/{repo}/+/content/{file_path}
	fileContentPath = repositoryBasePath + "/%s/%s/%s/%s/+/content/%s"
)

type RepositoryService struct {
	Client *Client
}

func (r *RepositoryService) Get(ctx context.Context, scope dto.Scope, repoIdentifier string) (*dto.Repository, error) {
	path := fmt.Sprintf(repositoryGetPath, repoIdentifier)
	params := make(map[string]string)
	addScope(scope, params)

	repo := new(dto.Repository)
	err := r.Client.Get(ctx, path, params, nil, repo)
	if err != nil {
		return nil, fmt.Errorf("failed to get repository: %w", err)
	}

	return repo, nil
}

// setDefaultPaginationForRepo sets default pagination values for RepositoryOptions
func setDefaultPaginationForRepo(opts *dto.RepositoryOptions) {
	if opts == nil {
		return
	}
	if opts.Page <= 0 {
		opts.Page = 1
	}

	if opts.Limit <= 0 {
		opts.Limit = defaultPageSize
	} else if opts.Limit > maxPageSize {
		opts.Limit = maxPageSize
	}
}

func (r *RepositoryService) List(ctx context.Context, scope dto.Scope, opts *dto.RepositoryOptions) ([]*dto.Repository, error) {
	path := repositoryListPath
	params := make(map[string]string)
	addScope(scope, params)

	// Handle nil options by creating default options
	if opts == nil {
		opts = &dto.RepositoryOptions{}
	}

	setDefaultPaginationForRepo(opts)

	params["page"] = fmt.Sprintf("%d", opts.Page)
	params["limit"] = fmt.Sprintf("%d", opts.Limit)

	if opts.Query != "" {
		params["query"] = opts.Query
	}
	if opts.Sort != "" {
		params["sort"] = opts.Sort
	}
	if opts.Order != "" {
		params["order"] = opts.Order
	}

	var repos []*dto.Repository
	err := r.Client.Get(ctx, path, params, nil, &repos)
	if err != nil {
		return nil, fmt.Errorf("failed to list repositories: %w", err)
	}

	return repos, nil
}

// GetFileContent retrieves file content from a specific commit or branch
func (r *RepositoryService) GetFileContent(ctx context.Context, scope dto.Scope, repoIdentifier string, req *dto.FileContentRequest) (*dto.FileContent, error) {
	// Extract account, org, project from scope or use defaults
	account := scope.AccountID
	if account == "" {
		account = repoIdentifier // Use repo identifier as account if not specified
	}
	
	org := scope.OrgID
	if org == "" {
		org = "default" // Use default org if not specified
	}
	
	project := scope.ProjectID
	if project == "" && req.ProjectID != "" {
		project = req.ProjectID
	}
	
	// Construct the path with all components
	path := fmt.Sprintf(fileContentPath, account, org, project, repoIdentifier, url.PathEscape(req.Path))
	
	// Set up query parameters
	params := make(map[string]string)
	
	// Add routing ID if provided
	if req.RoutingID != "" {
		params["routingId"] = req.RoutingID
	} else if account != "" {
		// Use account as routing ID if not explicitly provided
		params["routingId"] = account
	}
	
	// Add git_ref (commit ID, branch name, or tag) parameter
	if req.GitRef != "" {
		// Handle different types of git references
		if strings.HasPrefix(req.GitRef, "refs/") {
			// Already a fully qualified reference
			params["git_ref"] = req.GitRef
		} else if len(req.GitRef) == 40 || len(req.GitRef) >= 7 && len(req.GitRef) < 40 && isHexString(req.GitRef) {
			// Looks like a commit SHA (full 40 char or abbreviated)
			params["git_ref"] = req.GitRef
		} else {
			// Assume it's a branch name or tag, use refs/heads/ prefix
			params["git_ref"] = "refs/heads/" + req.GitRef
		}
	}
	
	// Add include_commit parameter to get commit information
	params["include_commit"] = "true"
	
	// Make the API request
	fileContent := new(dto.FileContent)
	err := r.Client.Get(ctx, path, params, nil, fileContent)
	if err != nil {
		return nil, fmt.Errorf("failed to get file content: %w", err)
	}
	
	return fileContent, nil
}

// isHexString checks if a string contains only hexadecimal characters
func isHexString(s string) bool {
	for _, r := range s {
		if !((r >= '0' && r <= '9') || (r >= 'a' && r <= 'f') || (r >= 'A' && r <= 'F')) {
			return false
		}
	}
	return true
}
