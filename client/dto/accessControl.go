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
	AccountIdentifier string                      `json:"accountIdentifier,omitempty"`
	OrgIdentifier     string                      `json:"orgIdentifier,omitempty"`
	ProjectIdentifier string                      `json:"projectIdentifier,omitempty"`
	Identifier        string                      `json:"identifier,omitempty"`
	Name              string                      `json:"name,omitempty"`
	Color             string                      `json:"color,omitempty"`
	Description       string                      `json:"description,omitempty"`
	ResourceFilter    ResourceGroupResourceFilter `json:"resourceFilter,omitempty"`
}

type CreateRoleAssignmentRequestBody struct {
	Identifier              string                 `json:"identifier,omitempty"`
	ResourceGroupIdentifier string                 `json:"resourceGroupIdentifier,omitempty"`
	RoleIdentifier          string                 `json:"roleIdentifier,omitempty"`
	Principal               AccessControlPrincipal `json:"principal,omitempty"`
	Managed                 bool                   `json:"managed,omitempty"`
	Internal                bool                   `json:"internal,omitempty"`
	Disabled                bool                   `json:"disabled,omitempty"`
	RoleReference           RoleReference          `json:"roleReference,omitempty"`
}

type CreateRoleAssignmentOutputData struct {
	RoleAssignment RoleAssignment `json:"roleAssignment,omitempty"`
	Scope          Scope          `json:"scope,omitempty"`
	CreatedAt      int64          `json:"createdAt,omitempty"`
	LastModifiedAt int64          `json:"lastModifiedAt,omitempty"`
	HarnessManaged bool           `json:"harnessManaged,omitempty"`
}

type CreateResourceGroupRequestBody struct {
	ResourceGroup ResourceGroup `json:"resourceGroup,omitempty"`
}

type ResourceGroupResourceFilter struct {
	Resources []ResourceSelectorV2 `json:"resources,omitempty"`
}

type ResourceSelectorV2 struct {
	Identifiers  []string `json:"identifiers,omitempty"`
	ResourceType string   `json:"resourceType,omitempty"`
}

type CreateResourceGroupOutputData struct {
	ResourceGroup  ResourceGroup `json:"resourceGroup,omitempty"`
	CreatedAt      int64         `json:"createdAt,omitempty"`
	LastModifiedAt int64         `json:"lastModifiedAt,omitempty"`
	HarnessManaged bool          `json:"harnessManaged,omitempty"`
}

type CreateRoleOutputData struct {
	Role           Role  `json:"role,omitempty"`
	CreatedAt      int64 `json:"createdAt,omitempty"`
	LastModifiedAt int64 `json:"lastModifiedAt,omitempty"`
	HarnessManaged bool  `json:"harnessManaged,omitempty"`
	Scope          Scope `json:"scope,omitempty"`
}

type CreateUserGroupRequestBody struct {
	AccountIdentifier string   `json:"accountIdentifier,omitempty"`
	OrgIdentifier     string   `json:"orgIdentifier,omitempty"`
	ProjectIdentifier string   `json:"projectIdentifier,omitempty"`
	Identifier        string   `json:"identifier,omitempty"`
	Name              string   `json:"name,omitempty"`
	Description       string   `json:"description,omitempty"`
	Users             []string `json:"users,omitempty"`
}

type CreateUserGroupOutputData struct {
	AccountIdentifier string          `json:"accountIdentifier,omitempty"`
	OrgIdentifier     string          `json:"orgIdentifier,omitempty"`
	ProjectIdentifier string          `json:"projectIdentifier,omitempty"`
	Identifier        string          `json:"identifier,omitempty"`
	Name              string          `json:"name,omitempty"`
	Description       string          `json:"description,omitempty"`
	Users             []UserBasicInfo `json:"users,omitempty"`
}

type CreateServiceAccountRequestBody struct {
	Identifier        string `json:"identifier,omitempty"`
	Name              string `json:"name,omitempty"`
	Email             string `json:"email,omitempty"`
	Description       string `json:"description,omitempty"`
	AccountIdentifier string `json:"accountIdentifier,omitempty"`
	OrgIdentifier     string `json:"orgIdentifier,omitempty"`
	ProjectIdentifier string `json:"projectIdentifier,omitempty"`
}

type InviteUserRequestBody struct {
	Emails       []string      `json:"emails,omitempty"`
	UserGroups   []string      `json:"userGroups,omitempty"`
	RoleBindings []RoleBinding `json:"roleBindings,omitempty"`
}

type RoleBinding struct {
	ResourceGroupIdentifier string `json:"resourceGroupIdentifier,omitempty"`
	RoleIdentifier          string `json:"roleIdentifier,omitempty"`
	RoleScopeLevel          string `json:"roleScopeLevel,omitempty"`
	RoleName                string `json:"roleName,omitempty"`
	ResourceGroupName       string `json:"resourceGroupName,omitempty"`
	ManagedRole             bool   `json:"managedRole"`
}

type InviteUserOutputData struct {
	AddUserResponseMap map[string]string `json:"addUserResponseMap,omitempty"`
}

type CurrentUserData struct {
    UUID                        string      `json:"uuid,omitempty"`
    Name                        string      `json:"name,omitempty"`
    Email                       string      `json:"email,omitempty"`
    Token                       interface{} `json:"token,omitempty"`
    DefaultAccountId            string      `json:"defaultAccountId,omitempty"`
    Intent                      interface{} `json:"intent,omitempty"`
    Accounts                    []AccountInfo `json:"accounts,omitempty"`
    Admin                       bool        `json:"admin,omitempty"`
    TwoFactorAuthenticationEnabled bool     `json:"twoFactorAuthenticationEnabled,omitempty"`
    EmailVerified               bool        `json:"emailVerified,omitempty"`
    Locked                      bool        `json:"locked,omitempty"`
    Disabled                    bool        `json:"disabled,omitempty"`
    SignupAction                interface{} `json:"signupAction,omitempty"`
    Edition                     interface{} `json:"edition,omitempty"`
    BillingFrequency            interface{} `json:"billingFrequency,omitempty"`
    UTMInfo                     UTMInfo     `json:"utmInfo,omitempty"`
    ExternallyManaged           bool        `json:"externallyManaged,omitempty"`
    GivenName                   interface{} `json:"givenName,omitempty"`
    FamilyName                  interface{} `json:"familyName,omitempty"`
    ExternalId                  interface{} `json:"externalId,omitempty"`
    CreatedAt                   int64       `json:"createdAt,omitempty"`
    LastUpdatedAt               int64       `json:"lastUpdatedAt,omitempty"`
    UserPreferences             UserPreferences `json:"userPreferences,omitempty"`
    IsEnrichedInfoCollected     bool        `json:"isEnrichedInfoCollected,omitempty"`
    LastLogin                   int64       `json:"lastLogin,omitempty"`
}

type AccountInfo struct {
    UUID             string `json:"uuid,omitempty"`
    AccountName      string `json:"accountName,omitempty"`
    CompanyName      string `json:"companyName,omitempty"`
    DefaultExperience string `json:"defaultExperience,omitempty"`
    CreatedFromNG    bool   `json:"createdFromNG,omitempty"`
    NextGenEnabled   bool   `json:"nextGenEnabled,omitempty"`
}

type UTMInfo struct {
    UTMSource   interface{} `json:"utmSource,omitempty"`
    UTMContent  interface{} `json:"utmContent,omitempty"`
    UTMMedium   interface{} `json:"utmMedium,omitempty"`
    UTMTerm     interface{} `json:"utmTerm,omitempty"`
    UTMCampaign interface{} `json:"utmCampaign,omitempty"`
}

type UserPreferences struct {
    RecentSelectedScopes string      `json:"recent_selected_scopes,omitempty"`
    EnableNewNav         string      `json:"enable_new_nav,omitempty"`
    LandingPageURL       interface{} `json:"landing_page_url,omitempty"`
}