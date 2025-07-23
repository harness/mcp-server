package harness

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"strings"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/dto"

	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

func GetAllUsersTool(config *config.Config, usersClient *client.PrincipalService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_all_users",
			mcp.WithDescription("Get details of all the USERS."),
			mcp.WithString("search_term",
				mcp.Description("Optional search term to filter users. Search by email ID or name."),
			),
			WithScope(config, false),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			searchTerm, _ := OptionalParam[string](request, "search_term")

			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page, size, err := fetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page = int(math.Min(math.Max(float64(page), float64(minPage)), float64(maxPage)))
			size = int(math.Min(math.Max(float64(size), float64(minSize)), float64(maxSize)))

			startTime, _ := OptionalParam[int64](request, "start_time")
			endTime, _ := OptionalParam[int64](request, "end_time")

			startTime += 1
			endTime += 1

			data, err := usersClient.GetAllUsers(ctx, scope, searchTerm, page, size, nil)
			if err != nil {
				return nil, fmt.Errorf("failed to get users: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal users: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func GetUserInfoTool(config *config.Config, userInfoClient *client.PrincipalService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_user_info",
			mcp.WithDescription("Get User Info."),
			mcp.WithString("user_id",
				mcp.Required(),
				mcp.Description("The user id(UUID) to retrieve the user info."),
			),
			WithScope(config, false),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			userID, err := requiredParam[string](request, "user_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page, size, err := fetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page = int(math.Min(math.Max(float64(page), float64(minPage)), float64(maxPage)))
			size = int(math.Min(math.Max(float64(size), float64(minSize)), float64(maxSize)))

			data, err := userInfoClient.GetUserInfo(ctx, scope, userID, page, size)
			if err != nil {
				return nil, fmt.Errorf("Failed to get user info: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("Failed to marshal user info: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func GetUserGroupInfoTool(config *config.Config, userGroupInfoClient *client.PrincipalService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_user_group_info",
			mcp.WithDescription("Get User Group Info."),
			mcp.WithString("user_group_id",
				mcp.Required(),
				mcp.Description("The User Group ID to retrieve the user group info."),
			),
			WithScope(config, false),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			userGroupID, err := requiredParam[string](request, "user_group_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := userGroupInfoClient.GetUserGroupInfo(ctx, scope, userGroupID)
			if err != nil {
				return nil, fmt.Errorf("Failed to get user group info: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("Failed to marshal user group info: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func GetServiceAccountTool(config *config.Config, serviceAccountClient *client.PrincipalService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_service_account",
			mcp.WithDescription("Get Service Account Info."),
			mcp.WithString("service_account_id",
				mcp.Required(),
				mcp.Description("The Service Account ID to retrieve the service account info."),
			),
			WithScope(config, false),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			serviceAccountID, err := requiredParam[string](request, "service_account_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := serviceAccountClient.GetServiceAccount(ctx, scope, serviceAccountID)
			if err != nil {
				return nil, fmt.Errorf("failed to get service account info: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal service account info: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func GetRoleInfoTool(config *config.Config, roleInfoClient *client.RBACService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_role_info",
			mcp.WithDescription("Get details of a role."),
			mcp.WithString("role_id",
				mcp.Required(),
				mcp.Description("The role id used to retrieve the role details."),
			),
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			roleID, err := requiredParam[string](request, "role_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := roleInfoClient.GetRoleInfo(ctx, scope, roleID)
			if err != nil {
				return nil, fmt.Errorf("failed to get role info: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal role info: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func ListAvailableRolesTool(config *config.Config, rolesClient *client.RBACService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_available_roles",
			mcp.WithDescription("List the roles available in the account."),
			WithScope(config, false),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page, size, err := fetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page = int(math.Min(math.Max(float64(page), float64(minPage)), float64(maxPage)))
			size = int(math.Min(math.Max(float64(size), float64(minSize)), float64(maxSize)))

			data, err := rolesClient.ListAvailableRoles(ctx, scope, page, size)
			if err != nil {
				return nil, fmt.Errorf("failed to list the available roles: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal the available roles: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func ListAvailablePermissions(config *config.Config, permissionsClient *client.RBACService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_available_permissions",
			mcp.WithDescription("List The Permissions Available In The Account."),
			WithScope(config, false),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page, size, err := fetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page = int(math.Min(math.Max(float64(page), float64(minPage)), float64(maxPage)))
			size = int(math.Min(math.Max(float64(size), float64(minSize)), float64(maxSize)))

			data, err := permissionsClient.ListAvailablePermissions(ctx, scope, page, size)
			if err != nil {
				return nil, fmt.Errorf("Failed to list the available permissions: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("Failed to marshal the permissions of the user: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func ListRoleAssignmentsTool(config *config.Config, roleAssignmentsClient *client.RBACService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_role_assignments",
			mcp.WithDescription("List The Role Assignments."),
			mcp.WithString("resource_group_names",
				mcp.Description("Optional resource group name. For multiple resource groups, use comma-separated values."),
			),
			mcp.WithString("role_names",
				mcp.Description("Optional role name. For multiple roles, use comma-separated values."),
			),
			mcp.WithString("principal_type",
				mcp.Description("Optional principal type. For multiple principal types, use comma-separated values.\nAllowed values: USER, USER_GROUP, SERVICE_ACCOUNT"),
			),
			mcp.WithString("principal_scope_level_filter",
				mcp.Description("Optional principal scope level filter. For multiple principal scope level filters, use comma-separated values.\nAllowed values: account, organization, project"),
			),
			mcp.WithArray("principal_filter",
				mcp.Description("Optional array of principal filters"),
				mcp.Items(dto.RoleAssignmentPrincipalFilter{}),
			),
			WithScope(config, false),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page, size, err := fetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page = int(math.Min(math.Max(float64(page), float64(minPage)), float64(maxPage)))
			size = int(math.Min(math.Max(float64(size), float64(minSize)), float64(maxSize)))

			resourceGroupNamesList, err := OptionalParam[string](request, "resource_group_names")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			resourceGroupNames := strings.Split(resourceGroupNamesList, ",")

			roleNamesList, err := OptionalParam[string](request, "role_names")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			roleNames := strings.Split(roleNamesList, ",")

			principalTypesList, err := OptionalParam[string](request, "principal_type")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			principalScopeLevelFilterList, err := OptionalParam[string](request, "principal_scope_level_filter")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			var principalFilter []dto.RoleAssignmentPrincipalFilter
			if filterParam, exists := request.Params.Arguments["principal_filter"]; exists {
				if filterArray, ok := filterParam.([]interface{}); ok && len(filterArray) > 0 {
					principalFilter = make([]dto.RoleAssignmentPrincipalFilter, len(filterArray))
					for i, item := range filterArray {
						if filterMap, ok := item.(map[string]interface{}); ok {
							filter := dto.RoleAssignmentPrincipalFilter{}
							if scopeLevel, ok := filterMap["scopeLevel"].(string); ok {
								if _, ok := dto.AllowedScopeLevels[scopeLevel]; ok {
									filter.ScopeLevel = scopeLevel
								} else {
									return nil, fmt.Errorf("invalid scope level: %s", scopeLevel)
								}
							}
							if identifier, ok := filterMap["identifier"].(string); ok {
								filter.Identifier = identifier
							}
							if filterType, ok := filterMap["type"].(string); ok {
								if _, ok := dto.AllowedPrincipalTypes[filterType]; ok {
									filter.Type = filterType
								} else {
									return nil, fmt.Errorf("invalid principal type: %s", filterType)
								}
							}
							if uniqueId, ok := filterMap["uniqueId"].(string); ok {
								filter.UniqueId = uniqueId
							}
							principalFilter[i] = filter
						}
					}
				}
			}

			data, err := roleAssignmentsClient.ListRoleAssignmentsTool(ctx, scope, page, size, nil, resourceGroupNames, roleNames, principalTypesList, principalScopeLevelFilterList, principalFilter)
			if err != nil {
				return nil, fmt.Errorf("failed to list the role assignments: %w", err)
			}

			resp, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal the role assignments: %w", err)
			}

			return mcp.NewToolResultText(string(resp)), nil
		}
}
