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

// ListWorkspacesTool creates the list_workspaces MCP tool
func ListWorkspacesTool(config *config.Config, client *client.IacmService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("workspace_tools_list_workspaces",
			mcp.WithDescription("List all IaCM workspaces visible to the user. Supports filtering by project, org, and status. Use pagination for large result sets."),
			// Scope parameters (org_id, project_id, account_id)
			common.WithScope(config, true), // true = project_id is required
			// Filter parameters
			mcp.WithString("status",
				mcp.Description("Optional filter by workspace status (e.g., 'active', 'inactive', 'error')"),
			),
			// Pagination parameters
			WithPagination(), // Adds page and size parameters
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// 1. Extract and validate scope (org, project, account)
			scope, err := common.FetchScope(ctx, config, request, true)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("Invalid scope: %s", err.Error())), nil
			}

			// 2. Extract pagination parameters (page, size)
			page, size, err := FetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("Invalid pagination: %s", err.Error())), nil
			}

			// 3. Extract optional filter parameters
			status, err := OptionalParam[string](request, "status")
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("Invalid status parameter: %s", err.Error())), nil
			}

			// 4. Build options struct for REST API call
			opts := &dto.WorkspaceListOptions{
				PaginationOptions: dto.PaginationOptions{
					Page: page,
					Size: size,
				},
				Status:    status,
				ProjectID: scope.ProjectID,
				OrgID:     scope.OrgID,
			}

			// 5. Call IaCM REST API via client
			// RBAC is enforced by IaCM backend based on API key + scope
			data, err := client.ListWorkspaces(ctx, scope, opts)
			if err != nil {
				// Log error for audit trail (existing logging middleware captures this)
				return nil, fmt.Errorf("failed to list workspaces: %w", err)
			}

			// 6. Transform response to MCP-compatible JSON
			// Marshal the entire response (includes pagination metadata)
			responseJSON, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal workspace list: %w", err)
			}

			// 7. Return success result
			return mcp.NewToolResultText(string(responseJSON)), nil
		}
}

func GetWorkspaceTool(config *config.Config, client *client.IacmService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("workspace_tools_get_workspace",
			mcp.WithDescription("Get detailed metadata for a specific IaCM workspace, including status, last run, variables, and cost summary."),
			mcp.WithString("workspace_id",
				mcp.Required(),
				mcp.Description("The unique identifier of the workspace"),
			),
			common.WithScope(config, true),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Extract workspace_id
			workspaceID, err := RequiredParam[string](request, "workspace_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Extract scope
			scope, err := common.FetchScope(ctx, config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Call REST API
			data, err := client.GetWorkspace(ctx, scope, workspaceID)
			if err != nil {
				return nil, fmt.Errorf("failed to get workspace: %w", err)
			}

			// Marshal and return
			responseJSON, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal workspace: %w", err)
			}

			return mcp.NewToolResultText(string(responseJSON)), nil
		}
}

func ListResourcesTool(config *config.Config, client *client.IacmService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("resource_tools_list_resources",
			mcp.WithDescription("List all resources within an IaCM workspace. Supports filtering by provider, type, or module."),
			mcp.WithString("workspace_id",
				mcp.Required(),
				mcp.Description("The workspace ID to list resources from"),
			),
			mcp.WithString("provider",
				mcp.Description("Optional filter by provider (e.g., 'aws', 'azure', 'gcp')"),
			),
			mcp.WithString("type",
				mcp.Description("Optional filter by resource type (e.g., 'aws_instance', 'azurerm_virtual_machine')"),
			),
			mcp.WithString("module",
				mcp.Description("Optional filter by module name"),
			),
			common.WithScope(config, true),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			workspaceID, err := RequiredParam[string](request, "workspace_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := common.FetchScope(ctx, config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page, size, err := FetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			provider, _ := OptionalParam[string](request, "provider")
			resourceType, _ := OptionalParam[string](request, "type")
			module, _ := OptionalParam[string](request, "module")

			opts := &dto.ResourceListOptions{
				PaginationOptions: dto.PaginationOptions{Page: page, Size: size},
				Provider:          provider,
				Type:              resourceType,
				Module:            module,
			}

			data, err := client.ListResources(ctx, scope, workspaceID, opts)
			if err != nil {
				return nil, fmt.Errorf("failed to list resources: %w", err)
			}

			responseJSON, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal resources: %w", err)
			}

			return mcp.NewToolResultText(string(responseJSON)), nil
		}
}

func GetResourceTool(config *config.Config, client *client.IacmService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("resource_tools_get_resource",
			mcp.WithDescription("Retrieve full metadata of a specific IaCM resource, including type, module, provider, drift status, and cost data."),
			mcp.WithString("workspace_id",
				mcp.Required(),
				mcp.Description("The workspace ID containing the resource"),
			),
			mcp.WithString("resource_id",
				mcp.Required(),
				mcp.Description("The unique identifier of the resource"),
			),
			common.WithScope(config, true),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			workspaceID, err := RequiredParam[string](request, "workspace_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			resourceID, err := RequiredParam[string](request, "resource_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := common.FetchScope(ctx, config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.GetResource(ctx, scope, workspaceID, resourceID)
			if err != nil {
				return nil, fmt.Errorf("failed to get resource: %w", err)
			}

			responseJSON, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal resource: %w", err)
			}

			return mcp.NewToolResultText(string(responseJSON)), nil
		}
}

func ListModulesTool(config *config.Config, client *client.IacmService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("module_registry_tools_list_modules",
			mcp.WithDescription("List all modules in the IaCM project-level registry. Supports filtering by tag, version, or provider."),
			mcp.WithString("tag",
				mcp.Description("Optional filter by tag"),
			),
			mcp.WithString("version",
				mcp.Description("Optional filter by version"),
			),
			mcp.WithString("provider",
				mcp.Description("Optional filter by provider (e.g., 'aws', 'azure')"),
			),
			common.WithScope(config, true),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page, size, err := FetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			tag, _ := OptionalParam[string](request, "tag")
			version, _ := OptionalParam[string](request, "version")
			provider, _ := OptionalParam[string](request, "provider")

			opts := &dto.ModuleListOptions{
				PaginationOptions: dto.PaginationOptions{Page: page, Size: size},
				Tag:               tag,
				Version:           version,
				Provider:          provider,
			}

			data, err := client.ListModules(ctx, scope, opts)
			if err != nil {
				return nil, fmt.Errorf("failed to list modules: %w", err)
			}

			responseJSON, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal modules: %w", err)
			}

			return mcp.NewToolResultText(string(responseJSON)), nil
		}
}

func GetModuleTool(config *config.Config, client *client.IacmService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("module_registry_tools_get_module",
			mcp.WithDescription("Retrieve details of a specific IaCM module, including name, source repo, version, invocation count, and dependencies."),
			mcp.WithString("module_id",
				mcp.Required(),
				mcp.Description("The unique identifier of the module"),
			),
			common.WithScope(config, true),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			moduleID, err := RequiredParam[string](request, "module_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := common.FetchScope(ctx, config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.GetModule(ctx, scope, moduleID)
			if err != nil {
				return nil, fmt.Errorf("failed to get module: %w", err)
			}

			responseJSON, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal module: %w", err)
			}

			return mcp.NewToolResultText(string(responseJSON)), nil
		}
}
