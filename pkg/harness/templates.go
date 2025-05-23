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

func GetTemplateTool(config *config.Config, client *client.Client) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_template",
			mcp.WithDescription("Get details of a specific template in Harness."),
			mcp.WithString("template_identifier",
				mcp.Description("The identifier of the template"),
				mcp.Required(),
			),
			WithScope(config, true),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			templateID, err := OptionalParam[string](request, "template_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			
			if templateID == "" {
				return mcp.NewToolResultError("template_identifier is required"), nil
			}

			scope, err := fetchScope(config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.Templates.Get(ctx, scope, templateID)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to get template: %s", err)), nil
			}

			r, err := json.Marshal(data.Data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal template: %s", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func ListTemplatesTool(config *config.Config, client *client.Client) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_templates",
			mcp.WithDescription("List templates in Harness."),
			mcp.WithNumber("page",
				mcp.DefaultNumber(0),
				mcp.Description("Page number for pagination - page 0 is the first page"),
			),
			mcp.WithNumber("size",
				mcp.DefaultNumber(5),
				mcp.Max(20),
				mcp.Description("Number of items per page"),
			),
			mcp.WithString("search",
				mcp.Description("Optional search term to filter templates"),
			),
			mcp.WithString("template_list_type",
				mcp.Description("Optional type of template list (e.g., LastUpdated)"),
			),
			mcp.WithString("sort",
				mcp.Description("Optional sort order (e.g., lastUpdatedAt,DESC)"),
			),
			WithScope(config, true),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			page, err := OptionalParam[float64](request, "page")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			// Default is already 0, no need to set it
			size, err := OptionalParam[float64](request, "size")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			// Use default if value not provided
			if size == 0 {
				size = 5 // Default value
			}
			search, err := OptionalParam[string](request, "search")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			// Default is empty string, no need to set it
			templateListType, err := OptionalParam[string](request, "template_list_type")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			// Use default if value not provided
			if templateListType == "" {
				templateListType = "LastUpdated" // Default value
			}
			sort, err := OptionalParam[string](request, "sort")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			// Use default if value not provided
			if sort == "" {
				sort = "lastUpdatedAt,DESC" // Default value
			}
			scope, err := fetchScope(config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Create the options for listing templates
			options := &dto.TemplateListOptions{
				PaginationOptions: dto.PaginationOptions{
					Page: int(page),
					Size: int(size),
				},
				SearchTerm:       search,
				TemplateListType: templateListType,
				Sort:             sort,
			}

			data, err := client.Templates.List(ctx, scope, options)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to list templates: %s", err)), nil
			}

			r, err := json.Marshal(data.Data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal templates: %s", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}
