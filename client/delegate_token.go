package client

import (
	"context"
	"fmt"

	"github.com/harness/harness-mcp/client/dto"
)

const (
	delegateTokenListPath = "/delegate-token-ng"
)

type DelegateTokenClient struct {
	Client *Client
}

// setDefaultPaginationForDelegateToken sets default pagination values for DelegateTokenOptions
func setDefaultPaginationForDelegateToken(opts *dto.DelegateTokenOptions) {
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

// ListDelegateTokens retrieves a list of delegate tokens based on the provided options and scope.
// The API uses 0-based pagination. If opts is nil, default pagination values will be used.
// Returns:
// - []DelegateToken: List of delegate tokens for the current page
// - int: Total count of delegate tokens (across all pages)
// - error: Any error that occurred during the request
func (d *DelegateTokenClient) ListDelegateTokens(ctx context.Context, scope dto.Scope, opts *dto.DelegateTokenOptions) ([]dto.DelegateToken, int, error) {
	path := delegateTokenListPath
	params := make(map[string]string)
	addScope(scope, params)

	// Handle nil options by creating default options
	if opts == nil {
		opts = &dto.DelegateTokenOptions{}
	}

	setDefaultPaginationForDelegateToken(opts)

	// API uses 0-based pagination
	params["page"] = fmt.Sprintf("%d", opts.Page)
	params["size"] = fmt.Sprintf("%d", opts.Limit)

	if opts.Sort != "" {
		params["sort"] = opts.Sort
	}
	if opts.Order != "" {
		params["order"] = opts.Order
	}
	if opts.Status != "" {
		params["status"] = opts.Status
	}
	if opts.SearchTerm != "" {
		params["searchTerm"] = opts.SearchTerm
	}

	var response dto.DelegateTokenListResponse
	err := d.Client.Get(ctx, path, params, nil, &response)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list delegate tokens: %w", err)
	}

	return response.Resource, len(response.Resource), nil
}
