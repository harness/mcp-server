package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"strings"

	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/client"
	"github.com/harness/mcp-server/common/client/dto"
	"github.com/harness/mcp-server/common/pkg/common"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	"log/slog"
)

func GetAllUsersTool(config *config.McpServerConfig, usersClient *client.PrincipalService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_all_users",
			mcp.WithDescription("Get details of all the USERS."),
			mcp.WithString("search_term",
				mcp.Description("Optional search term to filter users. Search by email ID or name."),
			),
			common.WithScope(config, false),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			searchTerm, _ := OptionalParam[string](request, "search_term")

			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page, size, err := FetchPagination(request)
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

func GetUserInfoTool(config *config.McpServerConfig, userInfoClient *client.PrincipalService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_user_info",
			mcp.WithDescription("Get User Info."),
			mcp.WithString("user_id",
				mcp.Required(),
				mcp.Description("The user id(UUID) to retrieve the user info."),
			),
			common.WithScope(config, false),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			userID, err := RequiredParam[string](request, "user_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page, size, err := FetchPagination(request)
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

func GetUserGroupInfoTool(config *config.McpServerConfig, userGroupInfoClient *client.PrincipalService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_user_group_info",
			mcp.WithDescription("Get User Group Info."),
			mcp.WithString("user_group_id",
				mcp.Required(),
				mcp.Description("The User Group ID to retrieve the user group info."),
			),
			common.WithScope(config, false),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			userGroupID, err := RequiredParam[string](request, "user_group_id")
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

func GetServiceAccountTool(config *config.McpServerConfig, serviceAccountClient *client.PrincipalService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_service_account",
			mcp.WithDescription("Get Service Account Info."),
			mcp.WithString("service_account_id",
				mcp.Required(),
				mcp.Description("The Service Account ID to retrieve the service account info."),
			),
			common.WithScope(config, false),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			serviceAccountID, err := RequiredParam[string](request, "service_account_id")
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

func GetRoleInfoTool(config *config.McpServerConfig, roleInfoClient *client.ACLService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_role_info",
			mcp.WithDescription("Get details of a role."),
			mcp.WithString("role_id",
				mcp.Required(),
				mcp.Description("The role id used to retrieve the role details."),
			),
			common.WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			roleID, err := RequiredParam[string](request, "role_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := common.FetchScope(ctx, config, request, false)
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

func ListAvailableRolesTool(config *config.McpServerConfig, rolesClient *client.ACLService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_available_roles",
			mcp.WithDescription("List the roles available in the account."),
			common.WithScope(config, false),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page, size, err := FetchPagination(request)
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

func ListAvailablePermissions(config *config.McpServerConfig, permissionsClient *client.ACLService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_available_permissions",
			mcp.WithDescription("List The Permissions Available In The Account."),
			common.WithScope(config, false),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page, size, err := FetchPagination(request)
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

func ListRoleAssignmentsTool(config *config.McpServerConfig, roleAssignmentsClient *client.ACLService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
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
			common.WithScope(config, false),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page, size, err := FetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page = int(math.Min(math.Max(float64(page), float64(minPage)), float64(maxPage)))
			size = int(math.Min(math.Max(float64(size), float64(minSize)), float64(maxSize)))

			resourceGroupNamesList, err := OptionalParam[string](request, "resource_group_names")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			slog.InfoContext(ctx, "resourceGroupNameList: {}", "resourceGroupNameList", resourceGroupNamesList)
			resourceGroupNames := strings.Split(resourceGroupNamesList, ",")

			roleNamesList, err := OptionalParam[string](request, "role_names")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			slog.InfoContext(ctx, "roleNamesList: {}", "roleNamesList", roleNamesList)
			roleNames := strings.Split(roleNamesList, ",")

			principalTypesList, err := OptionalParam[string](request, "principal_type")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			slog.InfoContext(ctx, "principalTypesList: {}", "principalTypesList", principalTypesList)

			principalScopeLevelFilterList, err := OptionalParam[string](request, "principal_scope_level_filter")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			slog.InfoContext(ctx, "principalScopeLevelFilterList: {}", "principalScopeLevelFilterList", principalScopeLevelFilterList)

			var principalFilter []dto.RoleAssignmentPrincipalFilter
			if filterParam, exists := request.GetArguments()["principal_filter"]; exists {
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

func CreateRoleAssignmentTool(config *config.McpServerConfig, roleAssignmentsClient *client.ACLService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("create_role_assignment",
			mcp.WithDescription("Create a new role assignment."),
			mcp.WithString("role_assignment_identifier",
				mcp.Description("The identifier of the role assignment to create."),
			),
			mcp.WithString("role_assignment_resource_group_identifier",
				mcp.Required(),
				mcp.Description("The resource group identifier of the role assignment to create."),
			),
			mcp.WithString("role_assignment_role_identifier",
				mcp.Required(),
				mcp.Description("The role identifier of the role assignment to create."),
			),
			mcp.WithString("principal_scope_level",
				mcp.Description("The scope level of the principal to create."),
				mcp.Enum("account", "organization", "project"),
			),
			mcp.WithString("principal_identifier",
				mcp.Required(),
				mcp.Description("The identifier of the principal to create."),
			),
			mcp.WithString("principal_type",
				mcp.Required(),
				mcp.Description("The type of the principal to create."),
				mcp.Enum("USER", "USER_GROUP", "SERVICE_ACCOUNT"),
			),
			mcp.WithString("principal_unique_id",
				mcp.Required(),
				mcp.Description("The unique ID of the principal to create."),
			),
			common.WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			role_assignment_identifier, err := OptionalParam[string](request, "role_assignment_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			role_assignment_resource_group_identifier, err := RequiredParam[string](request, "role_assignment_resource_group_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			role_assignment_role_identifier, err := RequiredParam[string](request, "role_assignment_role_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			principal_scope_level, err := OptionalParam[string](request, "principal_scope_level")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			principal_identifier, err := RequiredParam[string](request, "principal_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			principal_type, err := RequiredParam[string](request, "principal_type")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			principal_unique_id, err := RequiredParam[string](request, "principal_unique_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			if principal_scope_level != "" {
				if _, ok := dto.AllowedScopeLevels[strings.ToLower(principal_scope_level)]; !ok {
					return mcp.NewToolResultError(fmt.Sprintf("invalid principal scope level: %s. Allowed values: account, organization, project", principal_scope_level)), nil
				}
			}

			if principal_type != "" {
				if _, ok := dto.AllowedPrincipalTypes[strings.ToUpper(principal_type)]; !ok {
					return mcp.NewToolResultError(fmt.Sprintf("invalid principal type: %s. Allowed values: USER, USER_GROUP, SERVICE_ACCOUNT", principal_type)), nil
				}
			}

			requestBody := &dto.CreateRoleAssignmentRequestBody{
				ResourceGroupIdentifier: role_assignment_resource_group_identifier,
				RoleIdentifier:          role_assignment_role_identifier,
				Principal: dto.AccessControlPrincipal{
					Identifier: principal_identifier,
					Type:       strings.ToUpper(principal_type),
					UniqueId:   principal_unique_id,
				},
			}

			if role_assignment_identifier != "" {
				requestBody.Identifier = role_assignment_identifier
			}

			if principal_scope_level != "" {
				requestBody.Principal.ScopeLevel = strings.ToLower(principal_scope_level)
			}

			// Print the request body as JSON for debugging
			requestBodyJSON, err := json.MarshalIndent(requestBody, "", "  ")
			if err != nil {
				slog.ErrorContext(ctx, "Failed to marshal request body for logging", "error", err)
			} else {
				slog.ErrorContext(ctx, "CreateRoleAssignment request body", "requestBody", string(requestBodyJSON))
			}

			data, err := roleAssignmentsClient.CreateRoleAssignment(ctx, scope, requestBody)
			if err != nil {
				return nil, fmt.Errorf("failed to create role assignment: %w | requestBody: %s", err, string(requestBodyJSON))
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal role assignment: %w | requestBody: %s", err, string(requestBodyJSON))
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func CreateResourceGroupTool(config *config.McpServerConfig, resourceGroupClient *client.ResourceGroupService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("create_resource_group",
			mcp.WithDescription("Create a new resource group."),
			mcp.WithString("resource_group_identifier",
				mcp.Description("The identifier of the resource group to create."),
			),
			mcp.WithString("resource_group_name",
				mcp.Description("The name of the resource group to create."),
			),
			mcp.WithString("resource_group_description",
				mcp.Description("The description of the resource group to create."),
			),
			mcp.WithObject("resource_filter",
				mcp.Description("Contains resource filter for a resource group"),
				mcp.Properties(map[string]any{
					"resources": map[string]any{
						"type":        "array",
						"description": "Array of resource selectors",
						"items": map[string]any{
							"type": "object",
							"properties": map[string]any{
								"resourceType": map[string]any{
									"type":        "string",
									"description": "The type of the resource (required)",
								},
								"identifiers": map[string]any{
									"type":        "array",
									"description": "Array of resource identifiers",
									"items": map[string]any{
										"type": "string",
									},
								},
							},
							"required": []string{"resourceType"},
						},
					},
				}),
			),
			common.WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			resourceGroupIdentifier, err := OptionalParam[string](request, "resource_group_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			resourceGroupName, err := OptionalParam[string](request, "resource_group_name")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			resourceGroupDescription, err := OptionalParam[string](request, "resource_group_description")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			var resourceFilter dto.ResourceGroupResourceFilter
			if resourceFilterParam, exists := request.GetArguments()["resource_filter"]; exists {
				if resourceFilterMap, ok := resourceFilterParam.(map[string]interface{}); ok {
					// Extract resources array
					if resourcesInterface, exists := resourceFilterMap["resources"]; exists {
						if resourcesArray, ok := resourcesInterface.([]interface{}); ok {
							resources := make([]dto.ResourceSelectorV2, 0, len(resourcesArray))

							// Process each resource in the array
							for _, resourceInterface := range resourcesArray {
								if resourceMap, ok := resourceInterface.(map[string]interface{}); ok {
									resource := dto.ResourceSelectorV2{}

									// Extract resourceType
									if resourceType, exists := resourceMap["resourceType"]; exists {
										if resourceTypeStr, ok := resourceType.(string); ok {
											resource.ResourceType = strings.ToUpper(resourceTypeStr)
										}
									}

									// Extract identifiers
									if identifiersInterface, exists := resourceMap["identifiers"]; exists {
										if identifiersArray, ok := identifiersInterface.([]interface{}); ok {
											identifiers := make([]string, 0, len(identifiersArray))
											for _, idInterface := range identifiersArray {
												if idStr, ok := idInterface.(string); ok {
													identifiers = append(identifiers, idStr)
												}
											}
											resource.Identifiers = identifiers
										}
									}

									resources = append(resources, resource)
								}
							}

							resourceFilter.Resources = resources
						}
					}
				}
			}

			resourceGroup := dto.ResourceGroup{
				Identifier:     resourceGroupIdentifier,
				Name:           resourceGroupName,
				Description:    resourceGroupDescription,
				ResourceFilter: resourceFilter,
			}

			resourceGroup.AccountIdentifier = scope.AccountID
			resourceGroup.OrgIdentifier = scope.OrgID
			resourceGroup.ProjectIdentifier = scope.ProjectID

			data, err := resourceGroupClient.CreateResourceGroup(ctx, scope, resourceGroup, nil)
			if err != nil {
				return nil, fmt.Errorf("failed to create resource group: %w", err)
			}

			r, err := json.Marshal(data.Data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal resource group: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func CreateRoleTool(config *config.McpServerConfig, rolesClient *client.ACLService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("create_role",
			mcp.WithDescription("Create a new role."),
			mcp.WithString("role_identifier", mcp.Required(), mcp.Description("The identifier of the role to create.")),
			mcp.WithString("role_name", mcp.Required(), mcp.Description("The name of the role to create.")),
			mcp.WithString("role_description", mcp.Description("The description of the role to create.")),
			mcp.WithString("role_permissions", mcp.Description("The permissions of the role to create, separated by comma.")),
			mcp.WithString("role_allowed_scope_levels", mcp.Description("The allowed scope levels of the role to create, separated by comma."), mcp.Enum("account", "organization", "project")),
			common.WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			roleIdentifier, err := RequiredParam[string](request, "role_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			roleName, err := RequiredParam[string](request, "role_name")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			roleDescription, err := OptionalParam[string](request, "role_description")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			rolePermissions, err := OptionalParam[string](request, "role_permissions")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			roleAllowedScopeLevels, err := OptionalParam[string](request, "role_allowed_scope_levels")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			var permissions []string
			if rolePermissions != "" {
				permissions = strings.Split(rolePermissions, ",")
			}

			var allowedScopeLevels []string
			if roleAllowedScopeLevels != "" {
				allowedScopeLevels = strings.Split(roleAllowedScopeLevels, ",")
				for i, scopeLevel := range allowedScopeLevels {
					allowedScopeLevels[i] = strings.ToLower(scopeLevel)
				}
			}

			opts := &dto.Role{
				Identifier: roleIdentifier,
				Name:       roleName,
			}

			if roleDescription != "" {
				opts.Description = roleDescription
			}

			if len(permissions) > 0 {
				opts.Permissions = permissions
			}

			if len(allowedScopeLevels) > 0 {
				opts.AllowedScopeLevels = allowedScopeLevels
			}

			data, err := rolesClient.CreateRole(ctx, scope, opts)
			if err != nil {
				return nil, fmt.Errorf("failed to create role: %w", err)
			}

			r, err := json.Marshal(data.Data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal role: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func CreateUserGroupTool(config *config.McpServerConfig, userGroupClient *client.PrincipalService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("create_user_group",
			mcp.WithDescription("Create a new user group."),
			mcp.WithString("user_group_identifier", mcp.Required(), mcp.Description("The identifier of the user group to create.")),
			mcp.WithString("user_group_name", mcp.Required(), mcp.Description("The name of the user group to create.")),
			mcp.WithString("user_group_description", mcp.Description("The description of the user group to create.")),
			mcp.WithString("user_group_users", mcp.Description("The emailIDs of the users of the user group to create, separated by comma.")),
			common.WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			identifier, err := RequiredParam[string](request, "user_group_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			name, err := RequiredParam[string](request, "user_group_name")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			description, err := OptionalParam[string](request, "user_group_description")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			usersString, err := OptionalParam[string](request, "user_group_users")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			users := strings.Split(usersString, ",")
			opts := &dto.CreateUserGroupRequestBody{
				Identifier:        identifier,
				Name:              name,
				Description:       description,
				Users:             users,
				AccountIdentifier: scope.AccountID,
				OrgIdentifier:     scope.OrgID,
				ProjectIdentifier: scope.ProjectID,
			}
			data, err := userGroupClient.CreateUserGroup(ctx, scope, opts)
			if err != nil {
				return nil, fmt.Errorf("failed to create user group: %w", err)
			}
			r, err := json.Marshal(data.Data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal user group: %w", err)
			}
			return mcp.NewToolResultText(string(r)), nil
		}
}

func CreateServiceAccountTool(config *config.McpServerConfig, serviceAccountClient *client.PrincipalService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("create_service_account",
			mcp.WithDescription("Create a new service account."),
			mcp.WithString("service_account_identifier", mcp.Required(), mcp.Description("The identifier of the service account to create.")),
			mcp.WithString("service_account_name", mcp.Required(), mcp.Description("The name of the service account to create.")),
			mcp.WithString("service_account_email", mcp.Required(), mcp.Description("The email of the service account to create.")),
			mcp.WithString("service_account_description", mcp.Description("The description of the service account to create.")),
			common.WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			identifier, err := RequiredParam[string](request, "service_account_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			name, err := RequiredParam[string](request, "service_account_name")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			email, err := RequiredParam[string](request, "service_account_email")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			description, err := OptionalParam[string](request, "service_account_description")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			opts := &dto.CreateServiceAccountRequestBody{
				Identifier:        identifier,
				Name:              name,
				Email:             email,
				Description:       description,
				AccountIdentifier: scope.AccountID,
				OrgIdentifier:     scope.OrgID,
				ProjectIdentifier: scope.ProjectID,
			}
			data, err := serviceAccountClient.CreateServiceAccount(ctx, scope, opts)
			if err != nil {
				return nil, fmt.Errorf("failed to create service account: %w", err)
			}
			r, err := json.Marshal(data.Data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal service account: %w", err)
			}
			return mcp.NewToolResultText(string(r)), nil
		}
}

func InviteUsersTool(config *config.McpServerConfig, usersClient *client.PrincipalService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("invite_users",
			mcp.WithDescription("Invite users to Harness with specified role bindings and user groups."),
			mcp.WithString("email_Ids",
				mcp.Required(),
				mcp.Description("Comma-separated list of email addresses of users to invite"),
			),
			mcp.WithString("user_group_ids",
				mcp.Description("Comma-separated list of user group identifiers to add the invited users to"),
			),
			mcp.WithArray("role_bindings",
				mcp.Description("Comma-separated list of role bindings to add the invited users to"),
				mcp.Items(map[string]any{
					"type": "object",
					"properties": map[string]any{
						"roleIdentifier": map[string]any{
							"type":        "string",
							"description": "The identifier of the role to bind to the user",
						},
						"resourceGroupIdentifier": map[string]any{
							"type":        "string",
							"description": "The identifier of the resource group to bind to the user",
						},
						"roleScopeLevel": map[string]any{
							"type":        "string",
							"description": "The scope of the role to bind to the user",
						},
						"roleName": map[string]any{
							"type":        "string",
							"description": "The name of the role to bind to the user",
						},
						"resourceGroupName": map[string]any{
							"type":        "string",
							"description": "The name of the resource group to bind to the user",
						},
						"managedRole": map[string]any{
							"type":        "string",
							"description": "The managed role to bind to the user. Enter 'true' or 'false'",
						},
					},
					"required": []string{"roleIdentifier", "roleName", "managedRole", "resourceGroupIdentifier", "roleScopeLevel", "resourceGroupName"},
				}),
			),
			common.WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			emailIds, err := RequiredParam[string](request, "email_Ids")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			emailIdsArray := strings.Split(emailIds, ",")

			userGroupIds, err := OptionalParam[string](request, "user_group_ids")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			userGroupIdsArray := strings.Split(userGroupIds, ",")

			var roleBindings []dto.RoleBinding
			if roleBindingsParam, exists := request.GetArguments()["role_bindings"]; exists {
				if roleBindingsArray, ok := roleBindingsParam.([]interface{}); ok {
					for _, roleBindingInterface := range roleBindingsArray {
						if roleBindingMap, ok := roleBindingInterface.(map[string]interface{}); ok {
							roleBinding := dto.RoleBinding{}
							if roleIdentifier, exists := roleBindingMap["roleIdentifier"]; exists {
								if roleIdentifierStr, ok := roleIdentifier.(string); ok {
									roleBinding.RoleIdentifier = roleIdentifierStr
								}
							}
							if resourceGroupIdentifier, exists := roleBindingMap["resourceGroupIdentifier"]; exists {
								if resourceGroupIdentifierStr, ok := resourceGroupIdentifier.(string); ok {
									roleBinding.ResourceGroupIdentifier = resourceGroupIdentifierStr
								}
							}
							if roleScope, exists := roleBindingMap["roleScopeLevel"]; exists {
								if roleScopeStr, ok := roleScope.(string); ok {
									if _, ok := dto.AllowedScopeLevels[strings.ToLower(roleScopeStr)]; ok {
										roleBinding.RoleScopeLevel = strings.ToLower(roleScopeStr)
									} else {
										return nil, fmt.Errorf("invalid role scope level: %s", roleScopeStr)
									}
								}
							}
							if roleName, exists := roleBindingMap["roleName"]; exists {
								if roleNameStr, ok := roleName.(string); ok {
									roleBinding.RoleName = roleNameStr
								}
							}
							if resourceGroupName, exists := roleBindingMap["resourceGroupName"]; exists {
								if resourceGroupNameStr, ok := resourceGroupName.(string); ok {
									roleBinding.ResourceGroupName = resourceGroupNameStr
								}
							}
							if managedRole, exists := roleBindingMap["managedRole"]; exists {
								if managedRoleStr, ok := managedRole.(string); ok {
									if managedRoleStr == "true" {
										roleBinding.ManagedRole = true
									} else {
										roleBinding.ManagedRole = false
									}
								}
							}
							roleBindings = append(roleBindings, roleBinding)
						}
					}
				}
			}

			data, err := usersClient.InviteUsers(ctx, scope, emailIdsArray, userGroupIdsArray, roleBindings, nil)
			if err != nil {
				return nil, fmt.Errorf("failed to invite users: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal invite users response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func DeleteUserGroupTool(config *config.McpServerConfig, userGroupClient *client.PrincipalService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("delete_user_group",
			mcp.WithDescription("Delete a user group."),
			mcp.WithString("user_group_identifier",
				mcp.Required(),
				mcp.Description("The identifier of the user group to delete."),
			),
			common.WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			userGroupIdentifier, err := RequiredParam[string](request, "user_group_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := userGroupClient.DeleteUserGroup(ctx, scope, userGroupIdentifier)
			if err != nil {
				return nil, fmt.Errorf("failed to delete user group: %w", err)
			}

			r, err := json.Marshal(data.Data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal delete user group response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func DeleteServiceAccountTool(config *config.McpServerConfig, serviceAccountClient *client.PrincipalService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("delete_service_account",
			mcp.WithDescription("Delete a service account."),
			mcp.WithString("service_account_identifier",
				mcp.Required(),
				mcp.Description("The identifier of the service account to delete."),
			),
			common.WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			serviceAccountIdentifier, err := RequiredParam[string](request, "service_account_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := serviceAccountClient.DeleteServiceAccount(ctx, scope, serviceAccountIdentifier)
			if err != nil {
				return nil, fmt.Errorf("failed to delete service account: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal delete service account response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func DeleteRoleTool(config *config.McpServerConfig, roleClient *client.ACLService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("delete_role",
			mcp.WithDescription("Delete a role."),
			mcp.WithString("role_identifier",
				mcp.Required(),
				mcp.Description("The identifier of the role to delete."),
			),
			common.WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			roleIdentifier, err := RequiredParam[string](request, "role_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := roleClient.DeleteRole(ctx, scope, roleIdentifier)
			if err != nil {
				return nil, fmt.Errorf("failed to delete role: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal delete role response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func DeleteResourceGroupTool(config *config.McpServerConfig, resourceGroupClient *client.ResourceGroupService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("delete_resource_group",
			mcp.WithDescription("Delete a resource group."),
			mcp.WithString("resource_group_identifier",
				mcp.Required(),
				mcp.Description("The identifier of the resource group to delete."),
			),
			common.WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			resourceGroupIdentifier, err := RequiredParam[string](request, "resource_group_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := resourceGroupClient.DeleteResourceGroup(ctx, scope, resourceGroupIdentifier)
			if err != nil {
				return nil, fmt.Errorf("failed to delete resource group: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal delete resource group response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func DeleteRoleAssignmentTool(config *config.McpServerConfig, roleAssignmentClient *client.ACLService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("delete_role_assignment",
			mcp.WithDescription("Delete a role assignment."),
			mcp.WithString("role_assignment_identifier",
				mcp.Required(),
				mcp.Description("The identifier of the role assignment to delete."),
			),
			common.WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			roleAssignmentIdentifier, err := RequiredParam[string](request, "role_assignment_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := roleAssignmentClient.DeleteRoleAssignment(ctx, scope, roleAssignmentIdentifier)
			if err != nil {
				return nil, fmt.Errorf("failed to delete role assignment: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal delete role assignment response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}
