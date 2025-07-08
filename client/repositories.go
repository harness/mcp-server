package client

import (
	"context"
	"fmt"

	"github.com/harness/harness-mcp/client/dto"
)

const (
	extRepositoryBasePath   = "code/api/v1/repos"
	intRepositoryBasePath   = "api/code/v1/repos"
	repositoryGetPathSuffix = "/%s"
)

type RepositoryService struct {
	Client           *Client
	UseInternalPaths bool
}

func (r *RepositoryService) Get(ctx context.Context, scope dto.Scope, repoIdentifier string) (*dto.Repository, error) {
	basePath := extRepositoryBasePath
	if r.UseInternalPaths {
		basePath = intRepositoryBasePath
	}
	path := fmt.Sprintf(basePath+repositoryGetPathSuffix, repoIdentifier)
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
	path := extRepositoryBasePath
	if r.UseInternalPaths {
		path = intRepositoryBasePath
	}
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
