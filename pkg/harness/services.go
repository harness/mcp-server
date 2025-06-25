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

// GetServiceTool creates a tool for getting details of a specific service
// https://apidocs.harness.io/tag/Services#operation/getServiceV2
func GetServiceTool(config *config.Config, client *client.ServiceClient) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_service",
			mcp.WithDescription("Get details of a specific service in Harness."),
			mcp.WithString("service_identifier",
				mcp.Required(),
				mcp.Description("The identifier of the service"),
			),
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			serviceIdentifier, err := requiredParam[string](request, "service_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.Get(ctx, scope, serviceIdentifier)
			if err != nil {
				return nil, fmt.Errorf("failed to get service: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal service: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// ListServicesTool creates a tool for listing services
// https://apidocs.harness.io/tag/Services#operation/getServiceList
func ListServicesTool(config *config.Config, client *client.ServiceClient) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_services",
			mcp.WithDescription("List services in Harness."),
			mcp.WithString("sort",
				mcp.Description("Optional field to sort by (e.g., name)"),
			),
			mcp.WithString("order",
				mcp.Description("Optional sort order (asc or desc)"),
			),
			mcp.WithNumber("page",
				mcp.DefaultNumber(0),
				mcp.Description("Page number for pagination (0-based)"),
			),
			mcp.WithNumber("limit",
				mcp.DefaultNumber(5),
				mcp.Max(20),
				mcp.Description("Number of services per page"),
			),
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			opts := &dto.ServiceOptions{}

			// Handle pagination
			page, err := OptionalParam[float64](request, "page")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if page >= 0 {
				opts.Page = int(page)
			}

			limit, err := OptionalParam[float64](request, "limit")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if limit > 0 {
				opts.Limit = int(limit)
			}

			// Handle other optional parameters
			sort, err := OptionalParam[string](request, "sort")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if sort != "" {
				opts.Sort = sort
			}

			order, err := OptionalParam[string](request, "order")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if order != "" {
				opts.Order = order
			}

			services, totalCount, err := client.List(ctx, scope, opts)
			if err != nil {
				return nil, fmt.Errorf("failed to list services: %w", err)
			}

			// Create response with services and metadata
			response := map[string]interface{}{
				"services":   services,
				"totalCount": totalCount,
				"pageSize":   opts.Limit,
				"pageNumber": opts.Page,
			}

			r, err := json.Marshal(response)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal service list: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}
