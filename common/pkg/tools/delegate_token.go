package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/client"
	"github.com/harness/mcp-server/common/client/dto"
	"github.com/harness/mcp-server/common/pkg/common"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// ListDelegateTokensTool creates a tool for listing delegate tokens
func ListDelegateTokensTool(config *config.McpServerConfig, client *client.DelegateTokenClient) (tool mcp.Tool, handler server.ToolHandlerFunc) {
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
			scope, err := common.FetchScope(ctx, config, request, false)
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
			response := dto.DelegateTokenListResponse{
				MetaData:         map[string]interface{}{},
				Resource:         tokens,
				ResponseMessages: []string{},
			}

			r, err := json.Marshal(response)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal delegate tokens list: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetDelegateTokenTool creates a tool for getting a delegate token by name
func GetDelegateTokenTool(config *config.McpServerConfig, client *client.DelegateTokenClient) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_delegate_token",
			mcp.WithDescription("Get a delegate token by name in Harness."),
			mcp.WithString("name",
				mcp.Description("Name of Delegate Token"),
				mcp.Required(),
			),
			mcp.WithString("status",
				mcp.Description("Status of Delegate Token (ACTIVE or REVOKED). If left empty both active and revoked tokens will be retrieved"),
				mcp.Enum("ACTIVE", "REVOKED"),
			),
			common.WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			name, err := RequiredParam[string](request, "name")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			status, err := OptionalParam[string](request, "status")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
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

			tokens, err := client.GetDelegateToken(ctx, scopeToSend, name, status)
			if err != nil {
				return nil, fmt.Errorf("failed to get delegate token: %w", err)
			}
			if len(tokens) == 0 {
				return mcp.NewToolResultError("delegate token not found"), nil
			}
			// Format timestamps for each token
			for i := range tokens {
				tokens[i].FormatTimestamps()
			}
			// Create response with tokens and metadata
			response := dto.DelegateTokenResponse{
				MetaData:         map[string]interface{}{},
				Resource:         tokens[0],
				ResponseMessages: []string{},
			}

			r, err := json.Marshal(response)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal delegate token: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// CreateDelegateTokenTool creates a tool for creating a new delegate token
func CreateDelegateTokenTool(config *config.McpServerConfig, client *client.DelegateTokenClient) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("create_delegate_token",
			mcp.WithDescription("Creates a new delegate token in Harness."),
			mcp.WithString("token_name",
				mcp.Description("Name of the delegate token to create"),
				mcp.Required(),
			),
			mcp.WithNumber("revoke_after",
				mcp.Description("Optional epoch time in milliseconds after which the token will be revoked"),
			),
			common.WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			tokenName, err := RequiredParam[string](request, "token_name")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			if err := validateTokenName(tokenName); err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			var revokeAfter *int64
			if revokeAfterFloat, err := OptionalParam[float64](request, "revoke_after"); err == nil && revokeAfterFloat > 0 {
				revokeAfterInt := int64(revokeAfterFloat)
				revokeAfter = &revokeAfterInt
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

			token, err := client.CreateDelegateToken(ctx, scopeToSend, tokenName, revokeAfter)
			if err != nil {
				return nil, fmt.Errorf("failed to create delegate token: %w", err)
			}

			token.FormatTimestamps()

			response := dto.DelegateTokenResponse{
				MetaData:         map[string]interface{}{},
				Resource:         token,
				ResponseMessages: []string{},
			}

			r, err := json.Marshal(response)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal delegate token: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// RevokeDelegateTokenTool creates a tool for revoking delegate tokens
func RevokeDelegateTokenTool(config *config.McpServerConfig, client *client.DelegateTokenClient) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("revoke_delegate_token",
			mcp.WithDescription("Revokes a delegate token in Harness."),
			mcp.WithString("token_name",
				mcp.Description("Name of the delegate token to revoke"),
				mcp.Required(),
			),
			common.WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Get token name
			tokenName, err := RequiredParam[string](request, "token_name")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			if err := validateTokenName(tokenName); err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Fetch scope from config and request
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Call appropriate API based on scope
			var scopeToSend dto.Scope
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

			token, err := client.RevokeDelegateToken(ctx, scopeToSend, tokenName)
			if err != nil {
				return nil, fmt.Errorf("failed to revoke delegate token: %w", err)
			}

			token.FormatTimestamps()

			response := dto.DelegateTokenResponse{
				MetaData:         map[string]interface{}{},
				Resource:         token,
				ResponseMessages: []string{},
			}

			r, err := json.Marshal(response)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// DeleteDelegateTokenTool creates a tool for deleting revoked delegate tokens
func DeleteDelegateTokenTool(config *config.McpServerConfig, client *client.DelegateTokenClient) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("delete_delegate_token",
			mcp.WithDescription("Deletes a revoked delegate token in Harness."),
			mcp.WithString("token_name",
				mcp.Description("Name of the delegate token to delete which is already revoked"),
				mcp.Required(),
			),
			common.WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Get token name
			tokenName, err := RequiredParam[string](request, "token_name")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			if err := validateTokenName(tokenName); err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Fetch scope from config and request
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Call appropriate API based on scope
			var scopeToSend dto.Scope
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

			err = client.DeleteDelegateToken(ctx, scopeToSend, tokenName)
			if err != nil {
				return nil, fmt.Errorf("failed to delete delegate token: %w", err)
			}

			return mcp.NewToolResultText("Delegate token deleted successfully"), nil
		}
}

// GetDelegateByTokenTool creates a tool for getting delegate token by name
func GetDelegateByTokenTool(config *config.McpServerConfig, client *client.DelegateTokenClient) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_delegate_by_token",
			mcp.WithDescription("Gets all delegates using a given delegate token name."),
			mcp.WithString("token_name",
				mcp.Description("Name of the delegate token to get all delegates using it."),
				mcp.Required(),
			),
			common.WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Get token name
			tokenName, err := RequiredParam[string](request, "token_name")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			if err := validateTokenName(tokenName); err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Fetch scope from config and request
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Call appropriate API based on scope
			var scopeToSend dto.Scope
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

			delegateGroups, err := client.GetDelegateByToken(ctx, scopeToSend, tokenName)
			if err != nil {
				return nil, fmt.Errorf("failed to get delegates by token: %w", err)
			}
			if len(delegateGroups) == 0 {
				return mcp.NewToolResultText("No delegates found using this token"), nil
			}

			// Create response with delegate groups
			response := dto.DelegateGroupsResponse{
				MetaData: map[string]interface{}{},
				Resource: dto.DelegateGroupsResource{
					DelegateGroupDetails: delegateGroups,
				},
				ResponseMessages: []string{},
			}

			r, err := json.Marshal(response)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal delegate groups: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func validateTokenName(name string) error {
	if name == "" {
		return fmt.Errorf("token name cannot be empty string")
	}

	trimmedName := strings.TrimSpace(name)
	if trimmedName == "" {
		return fmt.Errorf("token name cannot be empty string")
	}

	return nil
}
