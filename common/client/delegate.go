package client

import (
	"context"
	"fmt"

	"github.com/harness/mcp-server/common/client/dto"
)

const (
	delegateSetupPath = "/delegate-setup/listDelegates"
)

type DelegateClient struct {
	Client *Client
}

// ListDelegates retrieves a list of delegates based on the provided filter and scope.
// Parameters:
// - ctx: Context for the request
// - scope: The scope (account/org/project) for the delegates
// - filter: Filter options for listing delegates
// - opts: Additional options like 'all' to include underlying orgs/projects
// Returns:
// - []Delegate: List of delegates matching the filter
// - error: Any error that occurred during the request
func (d *DelegateClient) ListDelegates(ctx context.Context, scope dto.Scope, filter *dto.DelegateListFilter, opts *dto.DelegateListOptions) ([]dto.Delegate, error) {
	path := delegateSetupPath
	params := make(map[string]string)
	addScope(ctx, scope, params)

	if opts != nil && opts.All {
		params["all"] = "true"
	}

	// Use default filter if nil
	if filter == nil {
		filter = &dto.DelegateListFilter{
			FilterType: "Delegate",
		}
	}

	// Ensure filterType is set (required field)
	if filter.FilterType == "" {
		filter.FilterType = "Delegate"
	}

	var response dto.DelegateListResponse
	err := d.Client.Post(ctx, path, params, filter, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to list delegates: %w", err)
	}

	return response.Resource, nil
}
