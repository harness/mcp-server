package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/common"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// ListSettingsTool creates a tool for listing settings in Harness
func ListSettingsTool(config *config.Config, client *client.SettingsClient) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_settings",
			mcp.WithDescription("List settings in Harness with filtering options by category and group."),
			mcp.WithString("category",
				mcp.Required(),
				mcp.Description("Category to filter settings. Available categories: 'CD', 'CI', 'CE', 'CV', 'CF', 'STO', 'CORE', 'PMS', 'TEMPLATESERVICE', 'GOVERNANCE', 'CHAOS', 'SCIM', 'GIT_EXPERIENCE', 'CONNECTORS', 'EULA', 'NOTIFICATIONS', 'SUPPLY_CHAIN_ASSURANCE', 'USER', 'MODULES_VISIBILITY', 'DBOPS', 'IR'"),
			),
			mcp.WithString("group",
				mcp.Description("Optional group to filter settings within a category"),
			),
			mcp.WithBoolean("include_parent_scopes",
				mcp.Description("Flag to include the settings which only exist at the parent scopes"),
			),
			common.WithScope(config, false),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page, size, err := FetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			category, err := OptionalParam[string](request, "category")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			group, err := OptionalParam[string](request, "group")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Default includeParentScopes to true
			includeParentScopes := true

			// Check if parameter was provided
			includeParentScopesParam, err := OptionalParam[bool](request, "include_parent_scopes")
			if err == nil {
				includeParentScopes = includeParentScopesParam
			}

			// Call the client to get the settings
			opts := &dto.SettingsListOptions{
				Category:            category,
				Group:               group,
				IncludeParentScopes: includeParentScopes,
				PaginationOptions: dto.PaginationOptions{
					Page: page,
					Size: size,
				},
			}

			response, err := client.List(ctx, scope, opts)
			if err != nil {
				return nil, fmt.Errorf("failed to list settings: %w", err)
			}

			r, err := json.Marshal(response)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal settings list: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}
