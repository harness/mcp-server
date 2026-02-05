package tools

import (
	"context"
	"encoding/json"
	"fmt"

	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/client"
	"github.com/harness/mcp-server/common/client/dto"
	"github.com/harness/mcp-server/common/pkg/common"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// ListDelegatesTool creates a tool for listing delegates
func ListDelegatesTool(config *config.McpServerConfig, client *client.DelegateClient) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("core_list_delegates",
			mcp.WithDescription("Lists all delegates in Harness filtered by provided conditions."),
			mcp.WithString("status",
				mcp.Description("Filter on delegate connectivity"),
				mcp.Enum("CONNECTED", "DISCONNECTED", "ENABLED", "WAITING_FOR_APPROVAL", "DISABLED", "DELETED"),
			),
			mcp.WithString("description",
				mcp.Description("Filter on delegate description"),
			),
			mcp.WithString("host_name",
				mcp.Description("Filter on delegate hostName"),
			),
			mcp.WithString("delegate_name",
				mcp.Description("Filter on delegate name"),
			),
			mcp.WithString("delegate_type",
				mcp.Description("Filter on delegate type"),
			),
			mcp.WithString("delegate_group_identifier",
				mcp.Description("Filter on delegate group id"),
			),
			mcp.WithString("delegate_instance_filter",
				mcp.Description("Filter on delegate instance status"),
				mcp.Enum("EXPIRED", "AVAILABLE"),
			),
			mcp.WithString("auto_upgrade",
				mcp.Description("Filter on delegate auto upgrade"),
			),
			mcp.WithString("version_status",
				mcp.Description("Filter on delegate version status"),
				mcp.Enum("EXPIRED", "EXPIRING", "UNSUPPORTED", "ACTIVE"),
			),
			mcp.WithBoolean("all",
				mcp.Description("If true, returns delegates of underlying orgs/projects and ignores filters in request body"),
			),
			common.WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			filter := &dto.DelegateListFilter{
				FilterType: "Delegate",
			}

			// Handle filter parameters
			status, err := OptionalParam[string](request, "status")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if status != "" {
				filter.Status = status
			}

			description, err := OptionalParam[string](request, "description")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if description != "" {
				filter.Description = description
			}

			hostName, err := OptionalParam[string](request, "host_name")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if hostName != "" {
				filter.HostName = hostName
			}

			delegateName, err := OptionalParam[string](request, "delegate_name")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if delegateName != "" {
				filter.DelegateName = delegateName
			}

			delegateType, err := OptionalParam[string](request, "delegate_type")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if delegateType != "" {
				filter.DelegateType = delegateType
			}

			delegateGroupIdentifier, err := OptionalParam[string](request, "delegate_group_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if delegateGroupIdentifier != "" {
				filter.DelegateGroupIdentifier = delegateGroupIdentifier
			}

			delegateInstanceFilter, err := OptionalParam[string](request, "delegate_instance_filter")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if delegateInstanceFilter != "" {
				filter.DelegateInstanceFilter = delegateInstanceFilter
			}

			autoUpgrade, err := OptionalParam[string](request, "auto_upgrade")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if autoUpgrade != "" {
				filter.AutoUpgrade = autoUpgrade
			}

			versionStatus, err := OptionalParam[string](request, "version_status")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if versionStatus != "" {
				filter.VersionStatus = versionStatus
			}

			// Handle options
			opts := &dto.DelegateListOptions{}
			all, err := OptionalParam[bool](request, "all")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			opts.All = all

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

			delegates, err := client.ListDelegates(ctx, scopeToSend, filter, opts)
			if err != nil {
				return nil, fmt.Errorf("failed to list delegates: %w", err)
			}

			// Create response with delegates and metadata
			response := dto.DelegateListResponse{
				MetaData:         map[string]interface{}{},
				Resource:         delegates,
				ResponseMessages: []string{},
			}

			r, err := json.Marshal(response)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal delegates list: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}
