package tools

import (
	"context"
	"encoding/json"
	"fmt"

	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/client"
	pkgutils "github.com/harness/mcp-server/common/pkg/utils"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

const (
	fmeWorkspacesDefaultLimit   = 20
	fmeWorkspacesMaxLimit       = 1000
	fmeFeatureFlagsDefaultLimit = 20
	fmeFeatureFlagsMaxLimit     = 50
)

// ListFMEWorkspacesTool creates a tool for listing FME workspaces
func ListFMEWorkspacesTool(config *config.McpServerConfig, fmeService *client.FMEService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("list_fme_workspaces",
			mcp.WithDescription("List Feature Management & Experimentation (FME) workspaces. Returns workspace IDs and names. Use workspace IDs with list_fme_environments, list_fme_feature_flags, and fme_get_feature_flag."),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{ReadOnlyHint: pkgutils.ToBoolPtr(true)}),
			mcp.WithNumber("offset",
				mcp.Description("The number of workspaces to skip for pagination (default: 0)"),
			),
			mcp.WithNumber("limit",
				mcp.Description(fmt.Sprintf("The number of workspaces to return (default: %d, max: %d)", fmeWorkspacesDefaultLimit, fmeWorkspacesMaxLimit)),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			offset, err := OptionalIntParam(request, "offset")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if offset < 0 {
				return mcp.NewToolResultError("offset must be non-negative"), nil
			}

			limit, err := OptionalIntParamWithDefault(request, "limit", fmeWorkspacesDefaultLimit)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if limit > fmeWorkspacesMaxLimit {
				limit = fmeWorkspacesMaxLimit
			}

			workspaces, err := fmeService.ListWorkspaces(ctx, offset, limit)
			if err != nil {
				return nil, fmt.Errorf("failed to list FME workspaces: %w", err)
			}

			responseBytes, err := json.Marshal(workspaces)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal workspaces: %w", err)
			}

			return mcp.NewToolResultText(string(responseBytes)), nil
		}
}

// ListFMEEnvironmentsTool creates a tool for listing FME environments for a specific workspace
func ListFMEEnvironmentsTool(config *config.McpServerConfig, fmeService *client.FMEService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("list_fme_environments",
			mcp.WithDescription("List Feature Management & Experimentation (FME) environments for a specific workspace. Returns environment IDs and names. Use environment IDs with get_fme_feature_flag_definition."),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{ReadOnlyHint: pkgutils.ToBoolPtr(true)}),
			mcp.WithString("ws_id",
				mcp.Required(),
				mcp.Description("The workspace ID. Use list_fme_workspaces to find workspace IDs."),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			wsID, err := RequiredParam[string](request, "ws_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			environments, err := fmeService.ListEnvironments(ctx, wsID)
			if err != nil {
				return nil, fmt.Errorf("failed to list FME environments: %w", err)
			}

			responseBytes, err := json.Marshal(environments)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal environments: %w", err)
			}

			return mcp.NewToolResultText(string(responseBytes)), nil
		}
}

// ListFMEFeatureFlagsTool creates a tool for listing FME feature flags for a specific workspace
func ListFMEFeatureFlagsTool(config *config.McpServerConfig, fmeService *client.FMEService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("list_fme_feature_flags",
			mcp.WithDescription("List Feature Management & Experimentation (FME) feature flags for a specific workspace. Returns feature flag names and metadata. Use feature flag names with fme_get_feature_flag and get_fme_feature_flag_definition."),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{ReadOnlyHint: pkgutils.ToBoolPtr(true)}),
			mcp.WithString("ws_id",
				mcp.Required(),
				mcp.Description("The workspace ID. Use list_fme_workspaces to find workspace IDs."),
			),
			mcp.WithNumber("offset",
				mcp.Description("The number of feature flags to skip for pagination (default: 0)"),
			),
			mcp.WithNumber("limit",
				mcp.Description(fmt.Sprintf("The number of feature flags to return (default: %d, max: %d)", fmeFeatureFlagsDefaultLimit, fmeFeatureFlagsMaxLimit)),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			wsID, err := RequiredParam[string](request, "ws_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			offset, err := OptionalIntParam(request, "offset")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if offset < 0 {
				return mcp.NewToolResultError("offset must be non-negative"), nil
			}

			limit, err := OptionalIntParamWithDefault(request, "limit", fmeFeatureFlagsDefaultLimit)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if limit > fmeFeatureFlagsMaxLimit {
				limit = fmeFeatureFlagsMaxLimit
			}

			featureFlags, err := fmeService.ListFeatureFlags(ctx, wsID, offset, limit)
			if err != nil {
				return nil, fmt.Errorf("failed to list FME feature flags: %w", err)
			}

			responseBytes, err := json.Marshal(featureFlags)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal feature flags: %w", err)
			}

			return mcp.NewToolResultText(string(responseBytes)), nil
		}
}

// GetFMEFeatureFlagTool creates a tool for getting a specific FME feature flag
func GetFMEFeatureFlagTool(config *config.McpServerConfig, fmeService *client.FMEService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("fme_get_feature_flag",
			mcp.WithDescription("Get a specific Feature Management & Experimentation (FME) feature flag's metadata (name, description, traffic type). For targeting rules and treatments in a specific environment, use get_fme_feature_flag_definition instead."),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{ReadOnlyHint: pkgutils.ToBoolPtr(true)}),
			mcp.WithString("ws_id",
				mcp.Required(),
				mcp.Description("The workspace ID. Use list_fme_workspaces to find workspace IDs."),
			),
			mcp.WithString("feature_flag_name",
				mcp.Required(),
				mcp.Description("The name of the feature flag. Use list_fme_feature_flags to find feature flag names."),
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

			featureFlag, err := fmeService.GetFeatureFlag(ctx, wsID, flagName)
			if err != nil {
				return nil, fmt.Errorf("failed to get FME feature flag: %w", err)
			}

			responseBytes, err := json.Marshal(featureFlag)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal feature flag: %w", err)
			}

			return mcp.NewToolResultText(string(responseBytes)), nil
		}
}

// GetFMEFeatureFlagDefinitionTool creates a tool for getting a specific FME feature flag definition
func GetFMEFeatureFlagDefinitionTool(config *config.McpServerConfig, fmeService *client.FMEService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("get_fme_feature_flag_definition",
			mcp.WithDescription("Get the definition of a specific Feature Management & Experimentation (FME) feature flag in an environment. Returns targeting rules, treatments, and default treatment for that environment. For basic flag metadata, use fme_get_feature_flag instead."),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{ReadOnlyHint: pkgutils.ToBoolPtr(true)}),
			mcp.WithString("ws_id",
				mcp.Required(),
				mcp.Description("The workspace ID. Use list_fme_workspaces to find workspace IDs."),
			),
			mcp.WithString("feature_flag_name",
				mcp.Required(),
				mcp.Description("The name of the feature flag. Use list_fme_feature_flags to find feature flag names."),
			),
			mcp.WithString("environment_id_or_name",
				mcp.Required(),
				mcp.Description("The environment ID or name. Use list_fme_environments to find environment IDs."),
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
				return nil, fmt.Errorf("failed to get FME feature flag definition: %w", err)
			}

			responseBytes, err := json.Marshal(definition)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal feature flag definition: %w", err)
			}

			return mcp.NewToolResultText(string(responseBytes)), nil
		}
}
