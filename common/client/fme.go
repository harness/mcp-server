package client

import (
	"context"
	"fmt"
	"strconv"

	"github.com/harness/mcp-server/common/client/dto"
)

// FMEService provides access to Split.io FME APIs
type FMEService struct {
	Client *Client
}

// ListWorkspaces retrieves all FME workspaces
// GET https://api.split.io/internal/api/v2/workspaces
func (f *FMEService) ListWorkspaces(ctx context.Context) (*dto.FMEWorkspacesResponse, error) {
	var response dto.FMEWorkspacesResponse

	err := f.Client.Get(ctx, "internal/api/v2/workspaces", nil, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to list workspaces: %w", err)
	}

	return &response, nil
}

// ListEnvironments retrieves all environments for a specific workspace
// GET https://api.split.io/internal/api/v2/environments/ws/{wsId}
func (f *FMEService) ListEnvironments(ctx context.Context, wsID string) (*dto.FMEEnvironmentsResponse, error) {
	var response dto.FMEEnvironmentsResponse

	path := fmt.Sprintf("internal/api/v2/environments/ws/%s", wsID)
	err := f.Client.Get(ctx, path, nil, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to list environments: %w", err)
	}

	return &response, nil
}

// ListFeatureFlags retrieves feature flags for a specific workspace with pagination support.
// GET https://api.split.io/internal/api/v2/splits/ws/{wsId}
// offset specifies the number of items to skip; limit controls how many items to return (max 100).
func (f *FMEService) ListFeatureFlags(ctx context.Context, wsID string, offset, limit int) (*dto.FMEFeatureFlagsResponse, error) {
	var response dto.FMEFeatureFlagsResponse

	params := map[string]string{
		"offset": strconv.Itoa(offset),
		"limit":  strconv.Itoa(limit),
	}

	path := fmt.Sprintf("internal/api/v2/splits/ws/%s", wsID)
	err := f.Client.Get(ctx, path, params, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to list feature flags: %w", err)
	}

	return &response, nil
}

// GetFeatureFlagDefinition retrieves a specific feature flag definition
// GET https://api.split.io/internal/api/v2/splits/ws/{wsId}/{feature_flag_name}/environments/{environment_id_or_name}
func (f *FMEService) GetFeatureFlagDefinition(ctx context.Context, wsID, flagName, environmentIDOrName string) (*dto.FMEFeatureFlagDefinitionResponse, error) {
	var response dto.FMEFeatureFlagDefinitionResponse

	path := fmt.Sprintf("internal/api/v2/splits/ws/%s/%s/environments/%s", wsID, flagName, environmentIDOrName)
	err := f.Client.Get(ctx, path, nil, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to get feature flag definition: %w", err)
	}

	return &response, nil
}
