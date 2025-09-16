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

// ListFMEWorkspacesTool creates a tool for listing FME workspaces
func ListFMEWorkspacesTool(config *config.Config, fmeService *client.FMEService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("list_fme_workspaces",
			mcp.WithDescription("List Feature Management & Experimentation (FME) workspaces."),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			workspaces, err := fmeService.ListWorkspaces(ctx)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to list FME workspaces: %v", err)), nil
			}

			responseBytes, err := json.Marshal(workspaces)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal workspaces: %w", err)
			}

			return mcp.NewToolResultText(string(responseBytes)), nil
		}
}

// ListFMEEnvironmentsTool creates a tool for listing FME environments for a specific workspace
func ListFMEEnvironmentsTool(config *config.Config, fmeService *client.FMEService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("list_fme_environments",
			mcp.WithDescription("List Feature Management & Experimentation (FME) environments for a specific workspace."),
			mcp.WithString("ws_id",
				mcp.Required(),
				mcp.Description("The workspace ID to list environments for"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			wsID, err := RequiredParam[string](request, "ws_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			environments, err := fmeService.ListEnvironments(ctx, wsID)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to list FME environments: %v", err)), nil
			}

			responseBytes, err := json.Marshal(environments)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal environments: %w", err)
			}

			return mcp.NewToolResultText(string(responseBytes)), nil
		}
}

// ListFMEFeatureFlagsTool creates a tool for listing FME feature flags for a specific workspace
func ListFMEFeatureFlagsTool(config *config.Config, fmeService *client.FMEService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("list_fme_feature_flags",
			mcp.WithDescription("List Feature Management & Experimentation (FME) feature flags for a specific workspace."),
			mcp.WithString("ws_id",
				mcp.Required(),
				mcp.Description("The workspace ID to list feature flags for"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			wsID, err := RequiredParam[string](request, "ws_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			featureFlags, err := fmeService.ListFeatureFlags(ctx, wsID)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to list FME feature flags: %v", err)), nil
			}

			responseBytes, err := json.Marshal(featureFlags)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal feature flags: %w", err)
			}

			return mcp.NewToolResultText(string(responseBytes)), nil
		}
}

// GetFMEFeatureFlagDefinitionTool creates a tool for getting a specific FME feature flag definition
func GetFMEFeatureFlagDefinitionTool(config *config.Config, fmeService *client.FMEService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("get_fme_feature_flag_definition",
			mcp.WithDescription("Get the definition of a specific Feature Management & Experimentation (FME) feature flag in an environment."),
			mcp.WithString("ws_id",
				mcp.Required(),
				mcp.Description("The workspace ID"),
			),
			mcp.WithString("feature_flag_name",
				mcp.Required(),
				mcp.Description("The name of the feature flag"),
			),
			mcp.WithString("environment_id_or_name",
				mcp.Required(),
				mcp.Description("The environment ID or name"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			wsID, err := RequiredParam[string](request, "ws_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			flagName, err := RequiredParam[string](request, "feature_flag_name")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			envIDOrName, err := RequiredParam[string](request, "environment_id_or_name")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			definition, err := fmeService.GetFeatureFlagDefinition(ctx, wsID, flagName, envIDOrName)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to get FME feature flag definition: %v", err)), nil
			}

			responseBytes, err := json.Marshal(definition)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal feature flag definition: %w", err)
			}

			return mcp.NewToolResultText(string(responseBytes)), nil
		}
}
