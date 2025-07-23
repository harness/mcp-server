package dto

var AllowedPrincipalTypes = map[string]struct{}{
	"USER":            {},
	"USER_GROUP":      {},
	"SERVICE_ACCOUNT": {},
}

var AllowedScopeLevels = map[string]struct{}{
	"account":      {},
	"organization": {},
	"project":      {},
}

type AccessControlOutput[T any] struct {
	Status        string                 `json:"status,omitempty"`
	Data          T                      `json:"data,omitempty"`
	MetaData      map[string]interface{} `json:"metaData,omitempty"`
	CorrelationId string                 `json:"correlationId,omitempty"`
}

type RolesOutputData struct {
	TotalPages    int64                    `json:"totalPages,omitempty"`
	TotalItems    int64                    `json:"totalItems,omitempty"`
	PageItemCount int64                    `json:"pageItemCount,omitempty"`
	PageSize      int64                    `json:"pageSize,omitempty"`
	Content       []RolesOutputDataContent `json:"content,omitempty"`
}

type RolesOutputDataContent struct {
	Role                              RoleData `json:"role,omitempty"`
	CreatedAt                         int64    `json:"createdAt,omitempty"`
	LastModifiedAt                    int64    `json:"lastModifiedAt,omitempty"`
	RoleAssignedToUserCount           int64    `json:"roleAssignedToUserCount,omitempty"`
	RoleAssignedToUserGroupCount      int64    `json:"roleAssignedToUserGroupCount,omitempty"`
	RoleAssignedToServiceAccountCount int64    `json:"roleAssignedToServiceAccountCount,omitempty"`
}

type RoleData struct {
	Identifier  string   `json:"identifier,omitempty"`
	Name        string   `json:"name,omitempty"`
	Permissions []string `json:"permissions,omitempty"`
}

type PermissionsOutputData struct {
	Permission PermissionsOutputObject `json:"permission,omitempty"`
}

type PermissionsOutputObject struct {
	Identifier         string   `json:"identifier,omitempty"`
	Name               string   `json:"name,omitempty"`
	Status             string   `json:"status,omitempty"`
	IncludeInAllRoles  bool     `json:"includeInAllRoles,omitempty"`
	AllowedScopeLevels []string `json:"allowedScopeLevels,omitempty"`
	ResourceType       string   `json:"resourceType,omitempty"`
	Action             string   `json:"action,omitempty"`
}

type RoleAssignmentsOutputData struct {
	TotalPages    int64                              `json:"totalPages,omitempty"`
	TotalItems    int64                              `json:"totalItems,omitempty"`
	PageItemCount int64                              `json:"pageItemCount,omitempty"`
	PageSize      int64                              `json:"pageSize,omitempty"`
	Content       []RoleAssignmentsOutputDataContent `json:"content,omitempty"`
}

type RoleAssignmentsOutputDataContent struct {
	RoleAssignment RoleAssignment `json:"roleAssignment,omitempty"`
	Scope          Scope          `json:"scope,omitempty"`
	CreatedAt      int64          `json:"createdAt,omitempty"`
	LastModifiedAt int64          `json:"lastModifiedAt,omitempty"`
	HarnessManaged bool           `json:"harnessManaged,omitempty"`
}

type RoleAssignment struct {
	Identifier              string                 `json:"identifier,omitempty"`
	ResourceGroupIdentifier string                 `json:"resourceGroupIdentifier,omitempty"`
	RoleIdentifier          string                 `json:"roleIdentifier,omitempty"`
	Principal               AccessControlPrincipal `json:"principal,omitempty"`
	Managed                 bool                   `json:"managed,omitempty"`
	Internal                bool                   `json:"internal,omitempty"`
	Disabled                bool                   `json:"disabled,omitempty"`
	RoleReference           RoleReference          `json:"roleReference,omitempty"`
}

type AccessControlPrincipal struct {
	ScopeLevel string `json:"scopeLevel,omitempty"`
	Identifier string `json:"identifier,omitempty"`
	Type       string `json:"type,omitempty"`
	UniqueId   string `json:"uniqueId,omitempty"`
}

type RoleReference struct {
	Identifier string `json:"identifier,omitempty"`
	ScopeLevel string `json:"scopeLevel,omitempty"`
}

type UsersOutput struct {
	TotalPages    int64          `json:"totalPages,omitempty"`
	TotalItems    int64          `json:"totalItems,omitempty"`
	PageItemCount int64          `json:"pageItemCount,omitempty"`
	PageSize      int64          `json:"pageSize,omitempty"`
	Content       []UserInfoData `json:"content,omitempty"`
}

type UserData struct {
	Name              string `json:"name,omitempty"`
	Email             string `json:"email,omitempty"`
	UUID              string `json:"uuid,omitempty"`
	Locked            bool   `json:"locked,omitempty"`
	Disabled          bool   `json:"disabled,omitempty"`
	ExternallyManaged bool   `json:"externallyManaged,omitempty"`
}

type RoleAssignmentMetadataObject struct {
	Identifier              string `json:"identifier,omitempty"`
	RoleIdentifier          string `json:"roleIdentifier,omitempty"`
	RoleName                string `json:"roleName,omitempty"`
	RoleScopeLevel          string `json:"roleScopeLevel,omitempty"`
	ResourceGroupIdentifier string `json:"resourceGroupIdentifier,omitempty"`
	ResourceGroupName       string `json:"resourceGroupName,omitempty"`
	ManagedRole             bool   `json:"managedRole,omitempty"`
	ManagedRoleAssignment   bool   `json:"managedRoleAssignment,omitempty"`
}

type UsersRequestBody struct {
	ResourceGroupIdentifier string `json:"resourceGroupIdentifiers,omitempty"`
	RoleIdentifier          string `json:"roleIdentifiers,omitempty"`
}

type RoleInfoOutputData struct {
	Role           Role  `json:"role,omitempty"`
	Scope          Scope `json:"scope,omitempty"`
	HarnessManaged bool  `json:"harnessManaged,omitempty"`
	CreatedAt      int64 `json:"createdAt,omitempty"`
	LastModifiedAt int64 `json:"lastModifiedAt,omitempty"`
}

type Role struct {
	Identifier         string   `json:"identifier,omitempty"`
	Name               string   `json:"name,omitempty"`
	Permissions        []string `json:"permissions,omitempty"`
	AllowedScopeLevels []string `json:"allowedScopeLevels,omitempty"`
	Description        string   `json:"description,omitempty"`
	Tags               Tags     `json:"tags,omitempty"`
}

type Tags struct {
	PropertyName string `json:"propertyName,omitempty"`
}

type RoleAssignmentRequestBody struct {
	ResourceGroupFilter       []string                        `json:"resourceGroupFilter,omitempty"`
	RoleFilter                []string                        `json:"roleFilter,omitempty"`
	PrincipalTypeFilter       []string                        `json:"principalTypeFilter,omitempty"`
	PrincipalScopeLevelFilter []string                        `json:"principalScopeLevelFilter,omitempty"`
	PrincipalFilter           []RoleAssignmentPrincipalFilter `json:"principalFilter,omitempty"`
}

type UserInfoData struct {
	User                   UserData                       `json:"user,omitempty"`
	RoleAssignmentMetadata []RoleAssignmentMetadataObject `json:"roleAssignmentMetadata,omitempty"`
}

type UserGroupInfoData struct {
	AccountIdentifier string          `json:"accountIdentifier,omitempty"`
	OrgIdentifier     string          `json:"orgIdentifier,omitempty"`
	ProjectIdentifier string          `json:"projectIdentifier,omitempty"`
	Identifier        string          `json:"identifier,omitempty"`
	Name              string          `json:"name,omitempty"`
	Users             []UserBasicInfo `json:"users,omitempty"`
}

type UserBasicInfo struct {
	ID    string `json:"id,omitempty"`
	Email string `json:"email,omitempty"`
}

type ServiceAccountData struct {
	ServiceAccount               ServiceAccountInfo             `json:"serviceAccount,omitempty"`
	CreatedAt                    int64                          `json:"createdAt,omitempty"`
	LastModifiedAt               int64                          `json:"lastModifiedAt,omitempty"`
	TokensCount                  int64                          `json:"tokensCount,omitempty"`
	RoleAssignmentMetadataObject []RoleAssignmentMetadataObject `json:"roleAssignmentsMetadataDTO,omitempty"`
}

type ServiceAccountInfo struct {
	Identifier        string `json:"identifier,omitempty"`
	Name              string `json:"name,omitempty"`
	Email             string `json:"email,omitempty"`
	Description       string `json:"description,omitempty"`
	AccountIdentifier string `json:"accountIdentifier,omitempty"`
	OrgIdentifier     string `json:"orgIdentifier,omitempty"`
	ProjectIdentifier string `json:"projectIdentifier,omitempty"`
}

type RoleAssignmentPrincipalFilter struct {
	ScopeLevel string `json:"scopeLevel,omitempty"`
	Identifier string `json:"identifier,omitempty"`
	Type       string `json:"type,omitempty"`
	UniqueId   string `json:"uniqueId,omitempty"`
}

type ResourceGroup struct {
	AccountIdentifier string `json:"accountIdentifier,omitempty"`
	OrgIdentifier     string `json:"orgIdentifier,omitempty"`
	ProjectIdentifier string `json:"projectIdentifier,omitempty"`
	Identifier        string `json:"identifier,omitempty"`
	Name              string `json:"name,omitempty"`
	Color             string `json:"color,omitempty"`
	Description       string `json:"description,omitempty"`
}
