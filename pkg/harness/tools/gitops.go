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

// ListGitOpsApplicationsTool creates a tool for listing GitOps applications
// https://apidocs.harness.io/tag/Application#operation/ApplicationService_ListApps
func ListGitOpsApplicationsTool(config *config.Config, client *client.GitOpsService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_gitops_applications",
			mcp.WithDescription("List GitOps applications in Harness. Returns applications with their sync status, health status, and deployment information. GitOps applications are managed through Argo CD or similar GitOps tools."),
			mcp.WithString("search_term",
				mcp.Description("Optional search term to filter applications by name or other attributes"),
			),
			mcp.WithString("agent_identifier",
				mcp.Description("Optional agent identifier to filter applications by specific GitOps agent"),
			),
			mcp.WithString("filter_json",
				mcp.Description("Optional JSON string for advanced filtering. Example: {\"app.status.sync.status\": \"Synced\"} or {\"app.status.sync.status\": {\"$in\": [\"Synced\", \"OutOfSync\"]}}"),
			),
			mcp.WithString("sort_by",
				mcp.Description("Optional field to sort by (e.g., name, createdAt)"),
			),
			mcp.WithString("sort_order",
				mcp.Description("Optional sort order: ASC or DESC"),
			),
			mcp.WithBoolean("metadata_only",
				mcp.Description("Set to true to return only metadata without full application details"),
			),
			mcp.WithNumber("page",
				mcp.DefaultNumber(0),
				mcp.Description("Page number for pagination (0-based)"),
			),
			mcp.WithNumber("size",
				mcp.DefaultNumber(10),
				mcp.Max(100),
				mcp.Description("Number of applications per page (max 100)"),
			),
			common.WithScope(config, true),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			opts := &dto.GitOpsApplicationOptions{}

			// Handle search term
			searchTerm, err := OptionalParam[string](request, "search_term")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if searchTerm != "" {
				opts.SearchTerm = searchTerm
			}

			// Handle agent identifier
			agentIdentifier, err := OptionalParam[string](request, "agent_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if agentIdentifier != "" {
				opts.AgentIdentifier = agentIdentifier
			}

			// Handle filter JSON
			filterJSON, err := OptionalParam[string](request, "filter_json")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if filterJSON != "" {
				var filter map[string]interface{}
				if err := json.Unmarshal([]byte(filterJSON), &filter); err != nil {
					return mcp.NewToolResultError(fmt.Sprintf("invalid filter_json: %v", err)), nil
				}
				opts.Filter = filter
			}

			// Handle sort options
			sortBy, err := OptionalParam[string](request, "sort_by")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if sortBy != "" {
				opts.SortBy = sortBy
			}

			sortOrder, err := OptionalParam[string](request, "sort_order")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if sortOrder != "" {
				opts.SortOrder = sortOrder
			}

			// Handle metadata_only flag
			metadataOnly, err := OptionalParam[bool](request, "metadata_only")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			opts.MetadataOnly = metadataOnly

			// Handle pagination
			page, err := OptionalParam[float64](request, "page")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if page >= 0 {
				opts.Page = int(page)
			}

			size, err := OptionalParam[float64](request, "size")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if size > 0 {
				opts.Size = int(size)
			}

			// Call the GitOps service to list applications
			response, err := client.ListApplications(ctx, scope, opts)
			if err != nil {
				return nil, fmt.Errorf("failed to list GitOps applications: %w", err)
			}

			// Marshal the response
			r, err := json.Marshal(response)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal GitOps applications list: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}
