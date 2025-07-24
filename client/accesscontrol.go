package client

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/harness/harness-mcp/client/dto"
)

const (
	getUsersPath             = "/user/aggregate"
	getRolePath              = "/api/roles"
	listPermissionsPath      = "/api/permissions"
	listRoleAssignmentsPath  = "/api/roleassignments/filter"
	getUserGroupPath         = "/v2/user-groups"
	getServiceAccountPath    = "/serviceaccount/aggregate"
	createRoleAssignmentPath = "/api/roleassignments"
	createRolePath           = "/api/roles"
	createUserGroupPath      = "/v2/user-groups"
	createServiceAccountPath = "/serviceaccount"
	createResourceGroupPath  = "/api/v2/resourcegroup"
	inviteUserPath           = "/user/users"
)

type RBACService struct {
	Client *Client
}

type PrincipalService struct {
	Client *Client
}

type ResourceGroupService struct {
	Client *Client
}

func (u *PrincipalService) GetAllUsers(ctx context.Context, scope dto.Scope, searchTerm string, page int, size int, opts *dto.UsersRequestBody) (*dto.AccessControlOutput[dto.UsersOutput], error) {
	if opts == nil {
		opts = &dto.UsersRequestBody{}
	}

	params := make(map[string]string)
	params["pageIndex"] = fmt.Sprintf("%d", page)
	params["pageSize"] = fmt.Sprintf("%d", size)
	params["searchTerm"] = searchTerm

	addScope(scope, params)

	resp := &dto.AccessControlOutput[dto.UsersOutput]{}
	err := u.Client.Post(ctx, getUsersPath, params, opts, resp)
	if err != nil {
		return nil, fmt.Errorf("failed to list the users: %w", err)
	}

	return resp, nil
}

func (u *RBACService) GetRoleInfo(ctx context.Context, scope dto.Scope, roleID string) (*dto.AccessControlOutput[dto.RoleInfoOutputData], error) {
	params := make(map[string]string)

	path := fmt.Sprintf(getRolePath+"/%s", roleID)

	addScope(scope, params)
	resp := &dto.AccessControlOutput[dto.RoleInfoOutputData]{}
	err := u.Client.Get(ctx, path, params, map[string]string{}, resp)
	if err != nil {
		return nil, fmt.Errorf("failed to get role info: %w", err)
	}
	return resp, nil
}

func (r *RBACService) ListAvailableRoles(ctx context.Context, scope dto.Scope, page int, size int) (*dto.AccessControlOutput[dto.RolesOutputData], error) {

	params := make(map[string]string)
	params["accountIdentifier"] = scope.AccountID
	params["pageIndex"] = fmt.Sprintf("%d", page)
	params["pageSize"] = fmt.Sprintf("%d", size)

	addScope(scope, params)

	resp := &dto.AccessControlOutput[dto.RolesOutputData]{}
	err := r.Client.Get(ctx, getRolePath, params, map[string]string{}, resp)
	if err != nil {
		return nil, fmt.Errorf("failed to list the roles assigned to the user: %w", err)
	}

	return resp, nil

}

func (p *RBACService) ListAvailablePermissions(ctx context.Context, scope dto.Scope, page int, size int) (*dto.AccessControlOutput[[]dto.PermissionsOutputData], error) {

	params := make(map[string]string)
	params["accountIdentifier"] = scope.AccountID
	params["pageIndex"] = fmt.Sprintf("%d", page)
	params["pageSize"] = fmt.Sprintf("%d", size)

	addScope(scope, params)

	resp := &dto.AccessControlOutput[[]dto.PermissionsOutputData]{}
	err := p.Client.Get(ctx, listPermissionsPath, params, map[string]string{}, resp)
	if err != nil {
		return nil, fmt.Errorf("failed to list the permissions of the user: %w", err)
	}

	return resp, nil
}

func (ra *RBACService) ListRoleAssignmentsTool(ctx context.Context, scope dto.Scope, page int, size int, opts *dto.RoleAssignmentRequestBody, resourceGroupNames []string, roleNames []string, principalTypes string, principalScopeLevelFilter string, principalFilter []dto.RoleAssignmentPrincipalFilter) (*dto.AccessControlOutput[dto.RoleAssignmentsOutputData], error) {
	if opts == nil {
		opts = &dto.RoleAssignmentRequestBody{}
	}

	params := make(map[string]string)

	addScope(scope, params)

	if resourceGroupNames != nil && len(resourceGroupNames) > 0 {
		opts.ResourceGroupFilter = resourceGroupNames
	}
	if roleNames != nil && len(roleNames) > 0 {
		opts.RoleFilter = roleNames
	}

	if strings.TrimSpace(principalTypes) != "" {
		rawPrincipalTypes := strings.Split(principalTypes, ",")
		principalFilter := make([]string, 0)
		for _, pt := range rawPrincipalTypes {
			pt = strings.ToUpper(strings.TrimSpace(pt))
			if _, ok := dto.AllowedPrincipalTypes[pt]; ok {
				principalFilter = append(principalFilter, pt)
			} else {
				return nil, fmt.Errorf("Invalid principal type: %s\n", pt)
			}
		}
		if len(principalFilter) > 0 {
			opts.PrincipalTypeFilter = principalFilter
		}
	}

	if strings.TrimSpace(principalScopeLevelFilter) != "" {
		rawScopeList := strings.Split(principalScopeLevelFilter, ",")
		scopeFilter := make([]string, 0)
		for _, scope := range rawScopeList {
			scope = strings.ToLower(strings.TrimSpace(scope))
			if _, ok := dto.AllowedScopeLevels[scope]; ok {
				scopeFilter = append(scopeFilter, scope)
			} else {
				return nil, fmt.Errorf("Invalid scope level: %s\n", scope)
			}
		}
		if len(scopeFilter) > 0 {
			opts.PrincipalScopeLevelFilter = scopeFilter
		}
	}

	if principalFilter != nil && len(principalFilter) > 0 {
		opts.PrincipalFilter = principalFilter
	}

	resp := &dto.AccessControlOutput[dto.RoleAssignmentsOutputData]{}
	err := ra.Client.Post(ctx, listRoleAssignmentsPath, params, opts, resp)
	if err != nil {
		optsJSON, _ := json.MarshalIndent(opts, "", "  ")
		return nil, fmt.Errorf("failed to list the role assignments: %w\nRequest body: %s", err, string(optsJSON))
	}

	return resp, nil
}

func (uInfo *PrincipalService) GetUserInfo(ctx context.Context, scope dto.Scope, userID string, page int, size int) (*dto.AccessControlOutput[dto.UserInfoData], error) {

	params := make(map[string]string)
	path := fmt.Sprintf(getUsersPath+"/%s", userID)

	addScope(scope, params)

	resp := &dto.AccessControlOutput[dto.UserInfoData]{}
	err := uInfo.Client.Get(ctx, path, params, map[string]string{}, resp)
	if err != nil {
		return nil, fmt.Errorf("Failed to list the user info: %w", err)
	}

	return resp, nil
}

func (uGroupInfo *PrincipalService) GetUserGroupInfo(ctx context.Context, scope dto.Scope, userGroupID string) (*dto.AccessControlOutput[dto.UserGroupInfoData], error) {

	params := make(map[string]string)
	path := fmt.Sprintf(getUserGroupPath+"/%s", userGroupID)

	addScope(scope, params)

	resp := &dto.AccessControlOutput[dto.UserGroupInfoData]{}
	err := uGroupInfo.Client.Get(ctx, path, params, map[string]string{}, resp)
	if err != nil {
		return nil, fmt.Errorf("Failed to list the user group info: %w", err)
	}

	return resp, nil
}

func (sAccount *PrincipalService) GetServiceAccount(ctx context.Context, scope dto.Scope, serviceAccountID string) (*dto.AccessControlOutput[dto.ServiceAccountData], error) {

	params := make(map[string]string)
	path := fmt.Sprintf(getServiceAccountPath+"/%s", serviceAccountID)

	addScope(scope, params)

	resp := &dto.AccessControlOutput[dto.ServiceAccountData]{}

	err := sAccount.Client.Get(ctx, path, params, map[string]string{}, resp)
	if err != nil {
		return nil, fmt.Errorf("Failed to list the service account info: %w", err)
	}

	return resp, nil
}

func (rAssignment *RBACService) CreateRoleAssignment(ctx context.Context, scope dto.Scope, opts *dto.CreateRoleAssignmentRequestBody) (*dto.AccessControlOutput[dto.CreateRoleAssignmentOutputData], error) {
	if opts == nil {
		opts = &dto.CreateRoleAssignmentRequestBody{}
	}

	params := make(map[string]string)

	addScope(scope, params)

	resp := &dto.AccessControlOutput[dto.CreateRoleAssignmentOutputData]{}
	err := rAssignment.Client.Post(ctx, createRoleAssignmentPath, params, opts, resp)
	if err != nil {
		return nil, fmt.Errorf("failed to create role assignment: %w", err)
	}

	return resp, nil
}

func (cResourceGroup *ResourceGroupService) CreateResourceGroup(ctx context.Context, scope dto.Scope, resourceGroup dto.ResourceGroup, opts *dto.CreateResourceGroupRequestBody) (*dto.AccessControlOutput[dto.CreateResourceGroupOutputData], error) {
	if opts == nil {
		opts = &dto.CreateResourceGroupRequestBody{}
	}

	params := make(map[string]string)

	addScope(scope, params)

	opts.ResourceGroup = resourceGroup

	resp := &dto.AccessControlOutput[dto.CreateResourceGroupOutputData]{}
	err := cResourceGroup.Client.Post(ctx, createResourceGroupPath, params, opts, resp)
	if err != nil {
		optsJSON, _ := json.MarshalIndent(opts, "", "  ")
		return nil, fmt.Errorf("failed to create resource group: %w\nRequest body: %s", err, string(optsJSON))
	}

	return resp, nil
}

func (cRole *RBACService) CreateRole(ctx context.Context, scope dto.Scope, opts *dto.Role) (*dto.AccessControlOutput[dto.CreateRoleOutputData], error) {
	if opts == nil {
		opts = &dto.Role{}
	}

	params := make(map[string]string)

	addScope(scope, params)

	resp := &dto.AccessControlOutput[dto.CreateRoleOutputData]{}
	err := cRole.Client.Post(ctx, createRolePath, params, opts, resp)
	if err != nil {
		return nil, fmt.Errorf("failed to create role: %w", err)
	}

	return resp, nil
}

func (cUserGroup *PrincipalService) CreateUserGroup(ctx context.Context, scope dto.Scope, opts *dto.CreateUserGroupRequestBody) (*dto.AccessControlOutput[dto.CreateUserGroupOutputData], error) {
	if opts == nil {
		opts = &dto.CreateUserGroupRequestBody{}
	}

	params := make(map[string]string)

	addScope(scope, params)

	resp := &dto.AccessControlOutput[dto.CreateUserGroupOutputData]{}
	err := cUserGroup.Client.Post(ctx, createUserGroupPath, params, opts, resp)
	if err != nil {
		return nil, fmt.Errorf("failed to create user group: %w", err)
	}

	return resp, nil
}

func (cServiceAccount *PrincipalService) CreateServiceAccount(ctx context.Context, scope dto.Scope, opts *dto.CreateServiceAccountRequestBody) (*dto.AccessControlOutput[dto.ServiceAccountInfo], error) {
	if opts == nil {
		opts = &dto.CreateServiceAccountRequestBody{}
	}

	params := make(map[string]string)

	addScope(scope, params)

	resp := &dto.AccessControlOutput[dto.ServiceAccountInfo]{}
	err := cServiceAccount.Client.Post(ctx, createServiceAccountPath, params, opts, resp)
	if err != nil {
		return nil, fmt.Errorf("failed to create service account: %w", err)
	}

	return resp, nil
}

func (iUser *PrincipalService) InviteUsers(ctx context.Context, scope dto.Scope, emails []string, userGroups []string, roleBindings []dto.RoleBinding, opts *dto.InviteUserRequestBody) (*dto.AccessControlOutput[dto.InviteUserOutputData], error) {
	if opts == nil {
		opts = &dto.InviteUserRequestBody{}
	}

	params := make(map[string]string)

	addScope(scope, params)

	opts.Emails = emails
	opts.UserGroups = userGroups
	opts.RoleBindings = roleBindings

	resp := &dto.AccessControlOutput[dto.InviteUserOutputData]{}
	err := iUser.Client.Post(ctx, inviteUserPath, params, opts, resp)
	if err != nil {
		optsJSON, _ := json.MarshalIndent(opts, "", "  ")
		return nil, fmt.Errorf("failed to invite users: %w\nRequest body: %s", err, string(optsJSON))
	}

	return resp, nil
}
