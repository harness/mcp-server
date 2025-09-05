package client

import (
	"context"
	"fmt"

	"github.com/harness/harness-mcp/client/dto"
)

const (
	delegateTokenPath = "/delegate-token-ng"
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
// - error: Any error that occurred during the request
func (d *DelegateTokenClient) ListDelegateTokens(ctx context.Context, scope dto.Scope, opts *dto.DelegateTokenOptions) ([]dto.DelegateToken, error) {
	path := delegateTokenPath
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
		return nil, fmt.Errorf("failed to list delegate tokens: %w", err)
	}

	return response.Resource, nil
}

// GetDelegateToken retrieves a specific delegate token by name.
// Parameters:
// - ctx: Context for the request
// - scope: The scope (account/org/project) for the token
// - name: Name of the delegate token to retrieve
// - status: Optional status filter (ACTIVE/REVOKED)
// Returns:
// - *DelegateToken: The delegate token if found
// - error: Any error that occurred during the request
func (d *DelegateTokenClient) GetDelegateToken(ctx context.Context, scope dto.Scope, name string, status string) ([]dto.DelegateToken, error) {
	path := delegateTokenPath
	params := make(map[string]string)
	params["name"] = name

	addScope(scope, params)

	if status != "" {
		params["status"] = status
	}

	var response dto.DelegateTokenListResponse
	err := d.Client.Get(ctx, path, params, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to get delegate token: %w", err)
	}
	if len(response.Resource) == 0 {
		return nil, nil
	}

	return response.Resource, nil
}

// CreateDelegateToken creates a new delegate token with the specified parameters.
// Parameters:
// - ctx: Context for the request
// - scope: The scope (account/org/project) for the token
// - tokenName: Name of the delegate token
// - revokeAfter: Optional epoch time in milliseconds after which the token will be revoked
// Returns:
// - *DelegateToken: The created delegate token
// - error: Any error that occurred during the request
func (d *DelegateTokenClient) CreateDelegateToken(ctx context.Context, scope dto.Scope, tokenName string, revokeAfter *int64) (dto.DelegateToken, error) {
	path := delegateTokenPath
	params := make(map[string]string)
	addScope(scope, params)
	params["tokenName"] = tokenName

	if revokeAfter != nil {
		params["revokeAfter"] = fmt.Sprintf("%d", *revokeAfter)
	}

	var response dto.DelegateTokenResponse
	err := d.Client.Post(ctx, path, params, nil, map[string]string{}, &response)
	if err != nil {
		return dto.DelegateToken{}, fmt.Errorf("failed to create delegate token: %w", err)
	}

	return response.Resource, nil
}

// RevokeDelegateToken revokes a delegate token with the specified name.
// Parameters:
// - ctx: Context for the request
// - scope: The scope (account/org/project) for the token
// - tokenName: Name of the delegate token to revoke
// Returns:
// - DelegateToken: The revoked delegate token
// - error: Any error that occurred during the request
func (d *DelegateTokenClient) RevokeDelegateToken(ctx context.Context, scope dto.Scope, tokenName string) (dto.DelegateToken, error) {
	path := delegateTokenPath
	params := make(map[string]string)
	addScope(scope, params)
	params["tokenName"] = tokenName

	var response dto.DelegateTokenResponse
	err := d.Client.Put(ctx, path, params, nil, &response)
	if err != nil {
		return dto.DelegateToken{}, fmt.Errorf("failed to revoke delegate token: %w", err)
	}

	return response.Resource, nil
}

// DeleteDelegateToken deletes a revoked delegate token with the specified name.
// Parameters:
// - ctx: Context for the request
// - scope: The scope (account/org/project) for the token
// - tokenName: Name of the delegate token to delete
// Returns:
// - error: Any error that occurred during the request
func (d *DelegateTokenClient) DeleteDelegateToken(ctx context.Context, scope dto.Scope, tokenName string) error {
	path := delegateTokenPath
	params := make(map[string]string)
	addScope(scope, params)
	params["tokenName"] = tokenName

	err := d.Client.Delete(ctx, path, params, nil, nil)
	if err != nil {
		return fmt.Errorf("failed to delete delegate token. Please make sure the token exists and is REVOKED: %w", err)
	}

	return nil
}
