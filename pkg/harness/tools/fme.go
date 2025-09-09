package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// GetListFMEWorkspacesTool creates the list_fme_workspaces tool
func GetListFMEWorkspacesTool(config *config.Config, fmeClient *client.FMEService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_fme_workspaces",
			mcp.WithDescription("List available FME workspaces"),
			mcp.WithString("name",
				mcp.Description("Optional filter to search workspaces by name"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			nameFilter, err := OptionalParam[string](request, "name")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			var namePtr *string
			if nameFilter != "" {
				namePtr = &nameFilter
			}

			workspaces, err := fmeClient.ListWorkspaces(ctx, namePtr)
			if err != nil {
				return nil, fmt.Errorf("failed to list workspaces: %w", err)
			}

			r, err := json.Marshal(workspaces)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal workspaces: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetListFMEEnvironmentsTool creates the list_fme_environments tool
func GetListFMEEnvironmentsTool(config *config.Config, fmeClient *client.FMEService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_fme_environments",
			mcp.WithDescription("List environments in an FME workspace"),
			mcp.WithString("workspace_id",
				mcp.Description("Workspace ID to list environments for"),
				mcp.Required(),
			),
			mcp.WithString("name",
				mcp.Description("Optional filter to search environments by name"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			workspaceID, err := RequiredParam[string](request, "workspace_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			nameFilter, err := OptionalParam[string](request, "name")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			var namePtr *string
			if nameFilter != "" {
				namePtr = &nameFilter
			}

			environments, err := fmeClient.ListEnvironments(ctx, workspaceID, namePtr)
			if err != nil {
				return nil, fmt.Errorf("failed to list environments: %w", err)
			}

			r, err := json.Marshal(environments)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal environments: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetListFMEFeatureFlagsTool creates the list_fme_feature_flags tool
func GetListFMEFeatureFlagsTool(config *config.Config, fmeClient *client.FMEService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_fme_feature_flags",
			mcp.WithDescription("List feature flags in an FME workspace"),
			mcp.WithString("workspace_id",
				mcp.Description("Workspace ID to list feature flags for"),
				mcp.Required(),
			),
			mcp.WithString("name",
				mcp.Description("Optional filter to search feature flags by name"),
			),
			mcp.WithNumber("limit",
				mcp.Description("Maximum number of feature flags to return (default: 20)"),
				mcp.DefaultNumber(20),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			workspaceID, err := RequiredParam[string](request, "workspace_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			nameFilter, err := OptionalParam[string](request, "name")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			limitFloat, err := OptionalParam[float64](request, "limit")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			var namePtr *string
			if nameFilter != "" {
				namePtr = &nameFilter
			}

			var limitPtr *int
			if limitFloat > 0 {
				limit := int(limitFloat)
				limitPtr = &limit
			}

			featureFlags, err := fmeClient.ListFeatureFlags(ctx, workspaceID, namePtr, limitPtr)
			if err != nil {
				return nil, fmt.Errorf("failed to list feature flags: %w", err)
			}

			r, err := json.Marshal(featureFlags)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal feature flags: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetFMEFeatureFlagRolloutStatusTool creates the get_fme_feature_flag_rollout_status tool
func GetFMEFeatureFlagRolloutStatusTool(config *config.Config, fmeClient *client.FMEService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_fme_feature_flag_rollout_status",
			mcp.WithDescription("Get detailed rollout status for an FME feature flag to help determine which code branch will be executed"),
			mcp.WithString("workspace_id",
				mcp.Description("Workspace ID containing the feature flag"),
				mcp.Required(),
			),
			mcp.WithString("environment_id",
				mcp.Description("Environment ID to get rollout status for"),
				mcp.Required(),
			),
			mcp.WithString("flag_name",
				mcp.Description("Feature flag name to get rollout status for"),
				mcp.Required(),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			workspaceID, err := RequiredParam[string](request, "workspace_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			environmentID, err := RequiredParam[string](request, "environment_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			flagName, err := RequiredParam[string](request, "flag_name")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			rolloutStatus, err := fmeClient.GetFeatureFlagRolloutStatus(ctx, workspaceID, environmentID, flagName)
			if err != nil {
				return nil, fmt.Errorf("failed to get feature flag rollout status: %w", err)
			}

			r, err := json.Marshal(rolloutStatus)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal rollout status: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}