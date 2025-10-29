package client

import (
	"context"
	"fmt"
	"strconv"

	"github.com/harness/harness-mcp/client/dto"
)

const (
	settingsListPath = "/settings"
)

// SettingsClient provides methods to interact with the Harness settings API
type SettingsClient struct {
	*Client
}

// List retrieves settings based on the provided scope and options
func (c *SettingsClient) List(ctx context.Context, scope dto.Scope, opts *dto.SettingsListOptions) (*dto.SettingsResponse, error) {
	path := settingsListPath
	params := make(map[string]string)
	if scope.AccountID == "" {
		return nil, fmt.Errorf("accountIdentifier cannot be null")
	}
	addScope(ctx, scope, params)

	if opts != nil {
		if opts.Category != "" {
			params["category"] = opts.Category
		}
		if opts.Group != "" {
			params["group"] = opts.Group
		}
		if opts.IncludeParentScopes {
			params["includeParentScopes"] = "true"
		}
		// Add pagination parameters
		if opts.Page > 0 {
			params["page"] = strconv.Itoa(opts.Page)
		}
		if opts.Size > 0 {
			params["size"] = strconv.Itoa(opts.Size)
		}
	}

	var response dto.SettingsResponse
	err := c.Get(ctx, path, params, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to list settings: %w", err)
	}

	return &response, nil
}
