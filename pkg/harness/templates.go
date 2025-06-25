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

func ListTemplatesAccountTool(config *config.Config, client *client.TemplateService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_templates_account",
			mcp.WithDescription("List templates in the account scope."),
			mcp.WithString("search_term",
				mcp.Description("Optional search term to filter templates"),
			),
			mcp.WithString("template_list_type",
				mcp.Description("Type of templates to list (e.g., Step, Stage, Pipeline)"),
			),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			page, size, err := fetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			searchTerm, err := OptionalParam[string](request, "search_term")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			templateListType, err := OptionalParam[string](request, "template_list_type")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			opts := &dto.TemplateListOptions{
				SearchTerm:       searchTerm,
				TemplateListType: templateListType,
				PaginationOptions: dto.PaginationOptions{
					Page: page,
					Size: size,
				},
			}

			data, err := client.ListAccount(ctx, opts)
			if err != nil {
				return nil, fmt.Errorf("failed to list account templates: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal template list: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func ListTemplatesOrgTool(config *config.Config, client *client.TemplateService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_templates_org",
			mcp.WithDescription("List templates in the organization scope."),
			mcp.WithString("search_term",
				mcp.Description("Optional search term to filter templates"),
			),
			mcp.WithString("template_list_type",
				mcp.Description("Type of templates to list (e.g., Step, Stage, Pipeline)"),
			),
			WithScope(config, true),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := fetchScope(config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page, size, err := fetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			searchTerm, err := OptionalParam[string](request, "search_term")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			templateListType, err := OptionalParam[string](request, "template_list_type")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			opts := &dto.TemplateListOptions{
				SearchTerm:       searchTerm,
				TemplateListType: templateListType,
				PaginationOptions: dto.PaginationOptions{
					Page: page,
					Size: size,
				},
			}

			data, err := client.ListOrg(ctx, scope, opts)
			if err != nil {
				return nil, fmt.Errorf("failed to list org templates: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal template list: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func ListTemplatesProjectTool(config *config.Config, client *client.TemplateService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_templates_project",
			mcp.WithDescription("List templates in the project scope."),
			mcp.WithString("search_term",
				mcp.Description("Optional search term to filter templates"),
			),
			mcp.WithString("template_list_type",
				mcp.Description("Type of templates to list (e.g., Step, Stage, Pipeline)"),
			),
			WithScope(config, true),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := fetchScope(config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page, size, err := fetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			searchTerm, err := OptionalParam[string](request, "search_term")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			templateListType, err := OptionalParam[string](request, "template_list_type")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			opts := &dto.TemplateListOptions{
				SearchTerm:       searchTerm,
				TemplateListType: templateListType,
				PaginationOptions: dto.PaginationOptions{
					Page: page,
					Size: size,
				},
			}

			data, err := client.ListProject(ctx, scope, opts)
			if err != nil {
				return nil, fmt.Errorf("failed to list project templates: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal template list: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}
