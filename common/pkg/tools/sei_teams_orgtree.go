package tools

import (
	"context"
	"encoding/json"
	"fmt"

	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/client"
	"github.com/harness/mcp-server/common/pkg/common"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// ===== Teams Controller Tools =====

// GetTeamTool creates a tool for getting team information
func GetTeamTool(config *config.McpServerConfig, client *client.SEIService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_get_team",
			mcp.WithDescription("Get team information by team reference ID"),
			mcp.WithString("accountId",
				mcp.Required(),
				mcp.Description("Harness Account ID"),
			),
			mcp.WithString("teamRefId",
				mcp.Required(),
				mcp.Description("Team reference ID"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Required params
			accountID, err := RequiredParam[string](request, "accountId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			teamRefId, err := RequiredParam[string](request, "teamRefId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Build params map
			requestParams := map[string]interface{}{
				"accountId": accountID,
				"teamRefId": teamRefId,
			}

			// Call API
			resp, err := client.GetTeam(ctx, requestParams)
			if err != nil {
				return nil, fmt.Errorf("failed to get team: %w", err)
			}

			// Marshal the response to JSON
			r, err := json.Marshal(resp)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal team: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetTeamsListTool creates a tool for getting list of teams
func GetTeamsListTool(config *config.McpServerConfig, client *client.SEIService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_get_teams_list",
			mcp.WithDescription("Get list of teams with pagination"),
			common.WithScope(config, true),
			mcp.WithString("accountId",
				mcp.Required(),
				mcp.Description("Harness Account ID"),
			),
			mcp.WithBoolean("leafTeamsOnly",
				mcp.Description("Whether to return only leaf teams"),
			),
			mcp.WithNumber("page",
				mcp.DefaultNumber(0),
				mcp.Description("Page number for pagination (default: 0)"),
			),
			mcp.WithNumber("pageSize",
				mcp.DefaultNumber(100),
				mcp.Description("Page size for pagination (default: 100, max: 100)"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Required params
			accountID, err := RequiredParam[string](request, "accountId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Build params map
			requestParams := map[string]interface{}{
				"accountId": accountID,
			}

			// Optional params
			if orgId, ok, err := OptionalParamOK[string](request, "orgId"); ok && err == nil && orgId != "" {
				requestParams["orgId"] = orgId
			}
			if projectId, ok, err := OptionalParamOK[string](request, "projectId"); ok && err == nil && projectId != "" {
				requestParams["projectId"] = projectId
			}
			if leafTeamsOnly, ok, err := OptionalParamOK[bool](request, "leafTeamsOnly"); ok && err == nil {
				requestParams["leafTeamsOnly"] = leafTeamsOnly
			}
			if page, ok, err := OptionalParamOK[float64](request, "page"); ok && err == nil {
				requestParams["page"] = int(page)
			}
			if pageSize, ok, err := OptionalParamOK[float64](request, "pageSize"); ok && err == nil {
				requestParams["pageSize"] = int(pageSize)
			}

			// Call API
			resp, err := client.GetTeamsList(ctx, requestParams)
			if err != nil {
				return nil, fmt.Errorf("failed to get teams list: %w", err)
			}

			// Marshal the response to JSON
			r, err := json.Marshal(resp)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal teams list: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetTeamIntegrationsTool creates a tool for getting team integrations
func GetTeamIntegrationsTool(config *config.McpServerConfig, client *client.SEIService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_get_team_integrations",
			mcp.WithDescription("Get team integrations by team reference ID"),
			mcp.WithString("accountId",
				mcp.Required(),
				mcp.Description("Harness Account ID"),
			),
			mcp.WithString("teamRefId",
				mcp.Required(),
				mcp.Description("Team reference ID"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Required params
			accountID, err := RequiredParam[string](request, "accountId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			teamRefId, err := RequiredParam[string](request, "teamRefId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Build params map
			requestParams := map[string]interface{}{
				"accountId": accountID,
				"teamRefId": teamRefId,
			}

			// Call API
			resp, err := client.GetTeamIntegrations(ctx, requestParams)
			if err != nil {
				return nil, fmt.Errorf("failed to get team integrations: %w", err)
			}

			// Marshal the response to JSON
			r, err := json.Marshal(resp)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal team integrations: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetTeamDevelopersTool creates a tool for getting team developers
func GetTeamDevelopersTool(config *config.McpServerConfig, client *client.SEIService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_get_team_developers",
			mcp.WithDescription("Get team developers by team reference ID"),
			mcp.WithString("accountId",
				mcp.Required(),
				mcp.Description("Harness Account ID"),
			),
			mcp.WithString("teamRefId",
				mcp.Required(),
				mcp.Description("Team reference ID"),
			),
			mcp.WithNumber("page",
				mcp.Description("Page number for pagination"),
			),
			mcp.WithNumber("size",
				mcp.Description("Page size for pagination"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Required params
			accountID, err := RequiredParam[string](request, "accountId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			teamRefId, err := RequiredParam[string](request, "teamRefId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Build params map
			requestParams := map[string]interface{}{
				"accountId": accountID,
				"teamRefId": teamRefId,
			}

			// Optional params
			if page, ok, err := OptionalParamOK[float64](request, "page"); ok && err == nil {
				requestParams["page"] = int(page)
			}
			if size, ok, err := OptionalParamOK[float64](request, "size"); ok && err == nil {
				requestParams["size"] = int(size)
			}

			// Call API
			resp, err := client.GetTeamDevelopers(ctx, requestParams)
			if err != nil {
				return nil, fmt.Errorf("failed to get team developers: %w", err)
			}

			// Marshal the response to JSON
			r, err := json.Marshal(resp)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal team developers: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetTeamIntegrationFiltersTool creates a tool for getting team integration filters
func GetTeamIntegrationFiltersTool(config *config.McpServerConfig, client *client.SEIService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_get_team_integration_filters",
			mcp.WithDescription("Get team integration filters by team reference ID"),
			mcp.WithString("accountId",
				mcp.Required(),
				mcp.Description("Harness Account ID"),
			),
			mcp.WithString("teamRefId",
				mcp.Required(),
				mcp.Description("Team reference ID"),
			),
			mcp.WithString("integrationType",
				mcp.Description("Integration type to filter by"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Required params
			accountID, err := RequiredParam[string](request, "accountId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			teamRefId, err := RequiredParam[string](request, "teamRefId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Build params map
			requestParams := map[string]interface{}{
				"accountId": accountID,
				"teamRefId": teamRefId,
			}

			// Optional params
			if integrationType, ok, err := OptionalParamOK[string](request, "integrationType"); ok && err == nil && integrationType != "" {
				requestParams["integrationType"] = integrationType
			}

			// Call API
			resp, err := client.GetTeamIntegrationFilters(ctx, requestParams)
			if err != nil {
				return nil, fmt.Errorf("failed to get team integration filters: %w", err)
			}

			// Marshal the response to JSON
			r, err := json.Marshal(resp)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal team integration filters: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// ===== OrgTree Controller Tools =====

// GetOrgTreesTool creates a tool for getting organization trees
func GetOrgTreesTool(config *config.McpServerConfig, client *client.SEIService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_get_org_trees",
			mcp.WithDescription("Get organization trees with pagination"),
			common.WithScope(config, true),
			mcp.WithString("accountId",
				mcp.Required(),
				mcp.Description("Harness Account ID"),
			),
			mcp.WithNumber("pageIndex",
				mcp.DefaultNumber(0),
				mcp.Description("Page index for pagination"),
			),
			mcp.WithNumber("pageSize",
				mcp.DefaultNumber(50),
				mcp.Description("Page size for pagination"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Required params
			accountID, err := RequiredParam[string](request, "accountId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			scope, err := common.FetchScope(ctx, config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Build params map
			requestParams := map[string]interface{}{
				"accountId": accountID,
				"orgId":     scope.OrgID,
				"projectId": scope.ProjectID,
			}

			// Optional params
			if pageIndex, ok, err := OptionalParamOK[float64](request, "pageIndex"); ok && err == nil {
				requestParams["pageIndex"] = int(pageIndex)
			}
			if pageSize, ok, err := OptionalParamOK[float64](request, "pageSize"); ok && err == nil {
				requestParams["pageSize"] = int(pageSize)
			}

			// Call API
			resp, err := client.GetOrgTrees(ctx, requestParams)
			if err != nil {
				return nil, fmt.Errorf("failed to get org trees: %w", err)
			}

			// Marshal the response to JSON
			r, err := json.Marshal(resp)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal org trees: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetOrgTreeByIdTool creates a tool for getting a specific organization tree by ID
func GetOrgTreeByIdTool(config *config.McpServerConfig, client *client.SEIService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_get_org_tree_by_id",
			mcp.WithDescription("Get a specific organization tree by ID"),
			mcp.WithString("accountId",
				mcp.Required(),
				mcp.Description("Harness Account ID"),
			),
			mcp.WithNumber("id",
				mcp.Required(),
				mcp.Description("Organization tree ID"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Required params
			accountID, err := RequiredParam[string](request, "accountId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			id, err := RequiredParam[float64](request, "id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Build params map
			requestParams := map[string]interface{}{
				"accountId": accountID,
				"id":        int(id),
			}

			// Call API
			resp, err := client.GetOrgTreeById(ctx, requestParams)
			if err != nil {
				return nil, fmt.Errorf("failed to get org tree by id: %w", err)
			}

			// Marshal the response to JSON
			r, err := json.Marshal(resp)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal org tree: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetOrgTreeEfficiencyProfileTool creates a tool for getting efficiency profile reference ID
func GetOrgTreeEfficiencyProfileTool(config *config.McpServerConfig, client *client.SEIService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_get_org_tree_efficiency_profile",
			mcp.WithDescription("Get efficiency profile reference ID for an organization tree"),
			mcp.WithString("accountId",
				mcp.Required(),
				mcp.Description("Harness Account ID"),
			),
			mcp.WithNumber("orgTreeId",
				mcp.Required(),
				mcp.Description("Organization tree ID"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Required params
			accountID, err := RequiredParam[string](request, "accountId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			orgTreeId, err := RequiredParam[float64](request, "orgTreeId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Build params map
			requestParams := map[string]interface{}{
				"accountId": accountID,
				"orgTreeId": int(orgTreeId),
			}

			// Call API
			resp, err := client.GetOrgTreeEfficiencyProfile(ctx, requestParams)
			if err != nil {
				return nil, fmt.Errorf("failed to get org tree efficiency profile: %w", err)
			}

			// Marshal the response to JSON
			r, err := json.Marshal(resp)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal efficiency profile: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetOrgTreeProductivityProfileTool creates a tool for getting productivity profile reference ID
func GetOrgTreeProductivityProfileTool(config *config.McpServerConfig, client *client.SEIService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_get_org_tree_productivity_profile",
			mcp.WithDescription("Get productivity profile reference ID for an organization tree"),
			mcp.WithString("accountId",
				mcp.Required(),
				mcp.Description("Harness Account ID"),
			),
			mcp.WithNumber("orgTreeId",
				mcp.Required(),
				mcp.Description("Organization tree ID"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Required params
			accountID, err := RequiredParam[string](request, "accountId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			orgTreeId, err := RequiredParam[float64](request, "orgTreeId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Build params map
			requestParams := map[string]interface{}{
				"accountId": accountID,
				"orgTreeId": int(orgTreeId),
			}

			// Call API
			resp, err := client.GetOrgTreeProductivityProfile(ctx, requestParams)
			if err != nil {
				return nil, fmt.Errorf("failed to get org tree productivity profile: %w", err)
			}

			// Marshal the response to JSON
			r, err := json.Marshal(resp)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal productivity profile: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetOrgTreeBusinessAlignmentProfileTool creates a tool for getting business alignment profile reference ID
func GetOrgTreeBusinessAlignmentProfileTool(config *config.McpServerConfig, client *client.SEIService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_get_org_tree_business_alignment_profile",
			mcp.WithDescription("Get business alignment profile reference ID for an organization tree"),
			mcp.WithString("accountId",
				mcp.Required(),
				mcp.Description("Harness Account ID"),
			),
			mcp.WithNumber("orgTreeId",
				mcp.Required(),
				mcp.Description("Organization tree ID"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Required params
			accountID, err := RequiredParam[string](request, "accountId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			orgTreeId, err := RequiredParam[float64](request, "orgTreeId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Build params map
			requestParams := map[string]interface{}{
				"accountId": accountID,
				"orgTreeId": int(orgTreeId),
			}

			// Call API
			resp, err := client.GetOrgTreeBusinessAlignmentProfile(ctx, requestParams)
			if err != nil {
				return nil, fmt.Errorf("failed to get org tree business alignment profile: %w", err)
			}

			// Marshal the response to JSON
			r, err := json.Marshal(resp)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal business alignment profile: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetOrgTreeIntegrationsTool creates a tool for getting integrations associated with an organization tree
func GetOrgTreeIntegrationsTool(config *config.McpServerConfig, client *client.SEIService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_get_org_tree_integrations",
			mcp.WithDescription("Get integrations associated with an organization tree"),
			mcp.WithString("accountId",
				mcp.Required(),
				mcp.Description("Harness Account ID"),
			),
			mcp.WithNumber("orgTreeId",
				mcp.Required(),
				mcp.Description("Organization tree ID"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Required params
			accountID, err := RequiredParam[string](request, "accountId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			orgTreeId, err := RequiredParam[float64](request, "orgTreeId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Build params map
			requestParams := map[string]interface{}{
				"accountId": accountID,
				"orgTreeId": int(orgTreeId),
			}

			// Call API
			resp, err := client.GetOrgTreeIntegrations(ctx, requestParams)
			if err != nil {
				return nil, fmt.Errorf("failed to get org tree integrations: %w", err)
			}

			// Marshal the response to JSON
			r, err := json.Marshal(resp)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal org tree integrations: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetOrgTreeTeamsTool creates a tool for getting team hierarchy for an organization tree
func GetOrgTreeTeamsTool(config *config.McpServerConfig, client *client.SEIService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_get_org_tree_teams",
			mcp.WithDescription("Get team hierarchy for an organization tree"),
			mcp.WithString("accountId",
				mcp.Required(),
				mcp.Description("Harness Account ID"),
			),
			mcp.WithNumber("orgTreeId",
				mcp.Required(),
				mcp.Description("Organization tree ID"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Required params
			accountID, err := RequiredParam[string](request, "accountId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			orgTreeId, err := RequiredParam[float64](request, "orgTreeId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Build params map
			requestParams := map[string]interface{}{
				"accountId": accountID,
				"orgTreeId": int(orgTreeId),
			}

			// Call API
			resp, err := client.GetOrgTreeTeams(ctx, requestParams)
			if err != nil {
				return nil, fmt.Errorf("failed to get org tree teams: %w", err)
			}

			// Marshal the response to JSON
			r, err := json.Marshal(resp)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal org tree teams: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}
