package harness

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// ListTemplates creates a tool that allows querying templates at all scopes (account, org, project)
// depending on the input parameters.
func ListTemplates(config *config.Config, client *client.TemplateService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_templates",
			mcp.WithDescription("List templates at account, organization, or project scope depending on the provided parameters."),
			mcp.WithString("search_term",
				mcp.Description("Optional search term to filter templates"),
			),
			mcp.WithString("template_list_type",
				mcp.Description("Type of templates to list (e.g., Step, Stage, Pipeline)"),
			),
			mcp.WithString("scope",
				mcp.Description("Scope level to query templates from (account, org, project). If not specified, defaults to project if org_id and project_id are provided, org if only org_id is provided, or account otherwise."),
				mcp.Enum("account", "org", "project"),
			),
			WithScope(config, false),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Fetch pagination parameters
			page, size, err := fetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Fetch optional parameters
			searchTerm, err := OptionalParam[string](request, "search_term")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			templateListType, err := OptionalParam[string](request, "template_list_type")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Create options object
			opts := &dto.TemplateListOptions{
				SearchTerm:       searchTerm,
				TemplateListType: templateListType,
				PaginationOptions: dto.PaginationOptions{
					Page: page,
					Size: size,
				},
			}

			// Determine scope from parameters
			scopeParam, err := OptionalParam[string](request, "scope")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Try to fetch scope parameters (org_id, project_id) if provided
			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// If scope is not explicitly specified, determine it from available parameters
			if scopeParam == "" {
				if scope.ProjectID != "" && scope.OrgID != "" {
					scopeParam = "project"
				} else if scope.OrgID != "" {
					scopeParam = "org"
				} else {
					scopeParam = "account"
				}
			}

			// Call appropriate API based on scope
			var data *dto.TemplateMetaDataList
			switch scopeParam {
			case "account":
				data, err = client.ListAccount(ctx, opts)
				if err != nil {
					return nil, fmt.Errorf("failed to list account templates: %w", err)
				}
			case "org":
				if scope.OrgID == "" {
					return mcp.NewToolResultError("org_id is required for org scope"), nil
				}
				data, err = client.ListOrg(ctx, scope, opts)
				if err != nil {
					return nil, fmt.Errorf("failed to list org templates: %w", err)
				}
			case "project":
				if scope.OrgID == "" || scope.ProjectID == "" {
					return mcp.NewToolResultError("org_id and project_id are required for project scope"), nil
				}
				data, err = client.ListProject(ctx, scope, opts)
				if err != nil {
					return nil, fmt.Errorf("failed to list project templates: %w", err)
				}
			default:
				return mcp.NewToolResultError(fmt.Sprintf("invalid scope: %s", scopeParam)), nil
			}

			// Create a new TemplateListOutput from the data
			templateListOutput := dto.ToTemplateResponse(data)

			// Marshal and return the result
			r, err := json.Marshal(templateListOutput)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal template list: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}
