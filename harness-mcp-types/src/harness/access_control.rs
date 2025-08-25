use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Allowed principal types for access control
pub const ALLOWED_PRINCIPAL_TYPES: &[&str] = &["USER", "USER_GROUP", "SERVICE_ACCOUNT"];

/// Allowed scope levels for access control
pub const ALLOWED_SCOPE_LEVELS: &[&str] = &["account", "organization", "project"];

/// Generic access control output wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccessControlOutput<T> {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
    #[serde(rename = "metaData", skip_serializing_if = "Option::is_none")]
    pub meta_data: Option<HashMap<String, serde_json::Value>>,
    #[serde(rename = "correlationId", skip_serializing_if = "Option::is_none")]
    pub correlation_id: Option<String>,
}

/// Roles output data structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RolesOutputData {
    #[serde(rename = "totalPages", skip_serializing_if = "Option::is_none")]
    pub total_pages: Option<i64>,
    #[serde(rename = "totalItems", skip_serializing_if = "Option::is_none")]
    pub total_items: Option<i64>,
    #[serde(rename = "pageItemCount", skip_serializing_if = "Option::is_none")]
    pub page_item_count: Option<i64>,
    #[serde(rename = "pageSize", skip_serializing_if = "Option::is_none")]
    pub page_size: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<Vec<RolesOutputDataContent>>,
}

/// Role output data content
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RolesOutputDataContent {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub role: Option<RoleData>,
    #[serde(rename = "createdAt", skip_serializing_if = "Option::is_none")]
    pub created_at: Option<i64>,
    #[serde(rename = "lastModifiedAt", skip_serializing_if = "Option::is_none")]
    pub last_modified_at: Option<i64>,
    #[serde(rename = "roleAssignedToUserCount", skip_serializing_if = "Option::is_none")]
    pub role_assigned_to_user_count: Option<i64>,
    #[serde(rename = "roleAssignedToUserGroupCount", skip_serializing_if = "Option::is_none")]
    pub role_assigned_to_user_group_count: Option<i64>,
    #[serde(rename = "roleAssignedToServiceAccountCount", skip_serializing_if = "Option::is_none")]
    pub role_assigned_to_service_account_count: Option<i64>,
}

/// Role data structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoleData {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub identifier: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub permissions: Option<Vec<String>>,
}

/// Permissions output data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionsOutputData {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub permission: Option<PermissionsOutputObject>,
}

/// Permissions output object
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionsOutputObject {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub identifier: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub action: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resource: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allowed: Option<bool>,
}

/// User group data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserGroupData {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub identifier: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<HashMap<String, String>>,
    #[serde(rename = "orgIdentifier", skip_serializing_if = "Option::is_none")]
    pub org_identifier: Option<String>,
    #[serde(rename = "projectIdentifier", skip_serializing_if = "Option::is_none")]
    pub project_identifier: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub users: Option<Vec<String>>,
    #[serde(rename = "notificationConfigs", skip_serializing_if = "Option::is_none")]
    pub notification_configs: Option<Vec<NotificationConfig>>,
    #[serde(rename = "ssoGroupId", skip_serializing_if = "Option::is_none")]
    pub sso_group_id: Option<String>,
    #[serde(rename = "ssoGroupName", skip_serializing_if = "Option::is_none")]
    pub sso_group_name: Option<String>,
    #[serde(rename = "linkedSsoId", skip_serializing_if = "Option::is_none")]
    pub linked_sso_id: Option<String>,
    #[serde(rename = "linkedSsoDisplayName", skip_serializing_if = "Option::is_none")]
    pub linked_sso_display_name: Option<String>,
    #[serde(rename = "linkedSsoType", skip_serializing_if = "Option::is_none")]
    pub linked_sso_type: Option<String>,
    #[serde(rename = "externallyManaged", skip_serializing_if = "Option::is_none")]
    pub externally_managed: Option<bool>,
}

/// Notification configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationConfig {
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub notification_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub config: Option<serde_json::Value>,
}

/// Service account data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceAccountData {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub identifier: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<HashMap<String, String>>,
    #[serde(rename = "orgIdentifier", skip_serializing_if = "Option::is_none")]
    pub org_identifier: Option<String>,
    #[serde(rename = "projectIdentifier", skip_serializing_if = "Option::is_none")]
    pub project_identifier: Option<String>,
}

/// Role assignment data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoleAssignmentData {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub identifier: Option<String>,
    #[serde(rename = "roleIdentifier", skip_serializing_if = "Option::is_none")]
    pub role_identifier: Option<String>,
    #[serde(rename = "principalType", skip_serializing_if = "Option::is_none")]
    pub principal_type: Option<String>,
    #[serde(rename = "principalIdentifier", skip_serializing_if = "Option::is_none")]
    pub principal_identifier: Option<String>,
    #[serde(rename = "principalScopeLevel", skip_serializing_if = "Option::is_none")]
    pub principal_scope_level: Option<String>,
    #[serde(rename = "resourceGroupIdentifier", skip_serializing_if = "Option::is_none")]
    pub resource_group_identifier: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub managed: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub disabled: Option<bool>,
}

/// Resource group data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceGroupData {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub identifier: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<HashMap<String, String>>,
    #[serde(rename = "orgIdentifier", skip_serializing_if = "Option::is_none")]
    pub org_identifier: Option<String>,
    #[serde(rename = "projectIdentifier", skip_serializing_if = "Option::is_none")]
    pub project_identifier: Option<String>,
    #[serde(rename = "allowedScopeLevels", skip_serializing_if = "Option::is_none")]
    pub allowed_scope_levels: Option<Vec<String>>,
    #[serde(rename = "resourceFilter", skip_serializing_if = "Option::is_none")]
    pub resource_filter: Option<ResourceFilter>,
    #[serde(rename = "includedScopes", skip_serializing_if = "Option::is_none")]
    pub included_scopes: Option<Vec<ResourceScope>>,
}

/// Resource filter
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceFilter {
    #[serde(rename = "includeAllResources", skip_serializing_if = "Option::is_none")]
    pub include_all_resources: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resources: Option<Vec<ResourceFilterResource>>,
}

/// Resource filter resource
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceFilterResource {
    #[serde(rename = "resourceType", skip_serializing_if = "Option::is_none")]
    pub resource_type: Option<String>,
    #[serde(rename = "resourceIdentifier", skip_serializing_if = "Option::is_none")]
    pub resource_identifier: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attributeFilter: Option<Vec<AttributeFilter>>,
}

/// Attribute filter
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttributeFilter {
    #[serde(rename = "attributeName", skip_serializing_if = "Option::is_none")]
    pub attribute_name: Option<String>,
    #[serde(rename = "attributeValues", skip_serializing_if = "Option::is_none")]
    pub attribute_values: Option<Vec<String>>,
}

/// Resource scope
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceScope {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filter: Option<ScopeFilter>,
}

/// Scope filter
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScopeFilter {
    #[serde(rename = "includeChildScopes", skip_serializing_if = "Option::is_none")]
    pub include_child_scopes: Option<bool>,
}

/// User data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserData {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uuid: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
    #[serde(rename = "accountIdentifier", skip_serializing_if = "Option::is_none")]
    pub account_identifier: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub locked: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub disabled: Option<bool>,
    #[serde(rename = "externallyManaged", skip_serializing_if = "Option::is_none")]
    pub externally_managed: Option<bool>,
    #[serde(rename = "twoFactorAuthenticationEnabled", skip_serializing_if = "Option::is_none")]
    pub two_factor_authentication_enabled: Option<bool>,
    #[serde(rename = "emailVerified", skip_serializing_if = "Option::is_none")]
    pub email_verified: Option<bool>,
}

/// API key data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeyData {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub identifier: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<HashMap<String, String>>,
    #[serde(rename = "orgIdentifier", skip_serializing_if = "Option::is_none")]
    pub org_identifier: Option<String>,
    #[serde(rename = "projectIdentifier", skip_serializing_if = "Option::is_none")]
    pub project_identifier: Option<String>,
    #[serde(rename = "apiKeyType", skip_serializing_if = "Option::is_none")]
    pub api_key_type: Option<String>,
    #[serde(rename = "parentIdentifier", skip_serializing_if = "Option::is_none")]
    pub parent_identifier: Option<String>,
    #[serde(rename = "defaultTimeToExpireToken", skip_serializing_if = "Option::is_none")]
    pub default_time_to_expire_token: Option<i64>,
}

/// Token data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenData {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub identifier: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<HashMap<String, String>>,
    #[serde(rename = "apiKeyIdentifier", skip_serializing_if = "Option::is_none")]
    pub api_key_identifier: Option<String>,
    #[serde(rename = "parentIdentifier", skip_serializing_if = "Option::is_none")]
    pub parent_identifier: Option<String>,
    #[serde(rename = "apiKeyType", skip_serializing_if = "Option::is_none")]
    pub api_key_type: Option<String>,
    #[serde(rename = "validFrom", skip_serializing_if = "Option::is_none")]
    pub valid_from: Option<i64>,
    #[serde(rename = "validTo", skip_serializing_if = "Option::is_none")]
    pub valid_to: Option<i64>,
    #[serde(rename = "scheduledExpireTime", skip_serializing_if = "Option::is_none")]
    pub scheduled_expire_time: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub encoded_password: Option<String>,
}