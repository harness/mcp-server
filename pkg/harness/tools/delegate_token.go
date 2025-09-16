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

// ListDelegateTokensTool creates a tool for listing delegate tokens
func ListDelegateTokensTool(config *config.Config, client *client.DelegateTokenClient) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_delegate_tokens",
			mcp.WithDescription("List delegate tokens in Harness with filtering and pagination."),
			mcp.WithString("status",
				mcp.Description("Optional filter for token status (ACTIVE, REVOKED)"),
			),
			mcp.WithString("search_term",
				mcp.Description("Optional search term to filter tokens by name"),
			),
			mcp.WithString("sort",
				mcp.Description("Optional field to sort by (e.g., name, createdAt)"),
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
				mcp.Description("Number of tokens per page"),
			),
			common.WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			opts := &dto.DelegateTokenOptions{}

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

			// Handle filters
			status, err := OptionalParam[string](request, "status")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if status != "" {
				opts.Status = status
			}

			searchTerm, err := OptionalParam[string](request, "search_term")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if searchTerm != "" {
				opts.SearchTerm = searchTerm
			}

			// Handle sorting
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

			// Determine scope from parameters
			scopeParam, err := OptionalParam[string](request, "scope")
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
			var scopeToSend dto.Scope
			switch scopeParam {
			case "account":
				scopeToSend = dto.Scope{AccountID: scope.AccountID}
			case "org":
				if scope.OrgID == "" {
					return mcp.NewToolResultError("org_id is required for org scope"), nil
				}
				scopeToSend = dto.Scope{AccountID: scope.AccountID, OrgID: scope.OrgID}
			case "project":
				if scope.OrgID == "" || scope.ProjectID == "" {
					return mcp.NewToolResultError("org_id and project_id are required for project scope"), nil
				}
				scopeToSend = dto.Scope{AccountID: scope.AccountID, OrgID: scope.OrgID, ProjectID: scope.ProjectID}
			}

			tokens, err := client.ListDelegateTokens(ctx, scopeToSend, opts)
			if err != nil {
				return nil, fmt.Errorf("failed to list delegate tokens: %w", err)
			}

			// Format timestamps for each token
			for i := range tokens {
				tokens[i].FormatTimestamps()
			}

			// Create response with tokens and metadata
			response := map[string]interface{}{
				"tokens":     tokens,
				"pageSize":   opts.Limit,
				"pageNumber": opts.Page,
			}

			r, err := json.Marshal(response)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal delegate tokens list: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}
