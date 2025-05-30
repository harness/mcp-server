package client

import (
	"context"
	"fmt"
	"strings"

	"github.com/harness/harness-mcp/client/dto"
)

const (
	pullRequestBasePath   = "code/api/v1/repos"
	pullRequestGetPath    = pullRequestBasePath + "/%s/pullreq/%d"
	pullRequestListPath   = pullRequestBasePath + "/%s/pullreq"
	pullRequestCreatePath = pullRequestBasePath + "/%s/pullreq"
	pullRequestChecksPath = pullRequestBasePath + "/%s/pullreq/%d/checks"
)

type PullRequestService struct {
	Client *Client
}

func (p *PullRequestService) Get(ctx context.Context, scope dto.Scope, repoID string, prNumber int) (*dto.PullRequest, error) {
	path := fmt.Sprintf(pullRequestGetPath, repoID, prNumber)
	params := make(map[string]string)
	addScope(scope, params)

	pr := new(dto.PullRequest)
	err := p.Client.Get(ctx, path, params, nil, pr)
	if err != nil {
		return nil, fmt.Errorf("failed to get pull request: %w", err)
	}

	return pr, nil
}

// setDefaultPaginationForPR sets default pagination values for PullRequestOptions
// We don't use the generic functions here since it follows a different naming
// (uses page and limit instead of page and size)
func setDefaultPaginationForPR(opts *dto.PullRequestOptions) {
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

func (p *PullRequestService) List(ctx context.Context, scope dto.Scope, repoID string, opts *dto.PullRequestOptions) ([]*dto.PullRequest, error) {
	path := fmt.Sprintf(pullRequestListPath, repoID)
	params := make(map[string]string)
	addScope(scope, params)

	// Handle nil options by creating default options
	if opts == nil {
		opts = &dto.PullRequestOptions{}
	}

	setDefaultPaginationForPR(opts)

	params["page"] = fmt.Sprintf("%d", opts.Page)
	params["limit"] = fmt.Sprintf("%d", opts.Limit)

	if len(opts.State) > 0 {
		params["state"] = strings.Join(opts.State, ",")
	}
	if opts.SourceRepoRef != "" {
		params["source_repo_ref"] = opts.SourceRepoRef
	}
	if opts.SourceBranch != "" {
		params["source_branch"] = opts.SourceBranch
	}
	if opts.TargetBranch != "" {
		params["target_branch"] = opts.TargetBranch
	}
	if opts.Query != "" {
		params["query"] = opts.Query
	}
	if len(opts.CreatedBy) > 0 {
		createdByStrings := make([]string, len(opts.CreatedBy))
		for i, id := range opts.CreatedBy {
			createdByStrings[i] = fmt.Sprintf("%d", id)
		}
		params["created_by"] = strings.Join(createdByStrings, ",")
	}
	if opts.Order != "" {
		params["order"] = opts.Order
	}
	if opts.Sort != "" {
		params["sort"] = opts.Sort
	}
	if opts.CreatedLt > 0 {
		params["created_lt"] = fmt.Sprintf("%d", opts.CreatedLt)
	}
	if opts.CreatedGt > 0 {
		params["created_gt"] = fmt.Sprintf("%d", opts.CreatedGt)
	}
	if opts.UpdatedLt > 0 {
		params["updated_lt"] = fmt.Sprintf("%d", opts.UpdatedLt)
	}
	if opts.UpdatedGt > 0 {
		params["updated_gt"] = fmt.Sprintf("%d", opts.UpdatedGt)
	}
	if opts.AuthorID > 0 {
		params["author_id"] = fmt.Sprintf("%d", opts.AuthorID)
	}
	if opts.IncludeChecks {
		params["include_checks"] = "true"
	}

	var prs []*dto.PullRequest
	err := p.Client.Get(ctx, path, params, nil, &prs)
	if err != nil {
		return nil, fmt.Errorf("failed to list pull requests: %w", err)
	}

	return prs, nil
}

// Create creates a new pull request in the specified repository
func (p *PullRequestService) Create(ctx context.Context, scope dto.Scope, repoID string, createPR *dto.CreatePullRequest) (*dto.PullRequest, error) {
	path := fmt.Sprintf(pullRequestCreatePath, repoID)
	params := make(map[string]string)
	addScope(scope, params)

	if createPR == nil {
		createPR = &dto.CreatePullRequest{}
	}

	pr := new(dto.PullRequest)
	err := p.Client.Post(ctx, path, params, createPR, pr)
	if err != nil {
		return nil, fmt.Errorf("failed to create pull request: %w", err)
	}

	return pr, nil
}

// GetChecks retrieves the status checks for a specific pull request
func (p *PullRequestService) GetChecks(ctx context.Context, scope dto.Scope, repoID string, prNumber int) (*dto.PullRequestChecksResponse, error) {
	path := fmt.Sprintf(pullRequestChecksPath, repoID, prNumber)
	params := make(map[string]string)
	addScope(scope, params)

	checks := new(dto.PullRequestChecksResponse)
	err := p.Client.Get(ctx, path, params, nil, checks)
	if err != nil {
		return nil, fmt.Errorf("failed to get pull request checks: %w", err)
	}

	return checks, nil
}
