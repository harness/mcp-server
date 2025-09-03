use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use super::enums::*;

/// Scope information for Harness API requests
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Scope {
    pub account_id: String,
    pub org_id: Option<String>,
    pub project_id: Option<String>,
}

impl Scope {
    pub fn new(account_id: String) -> Self {
        Self {
            account_id,
            org_id: None,
            project_id: None,
        }
    }

    pub fn with_org(mut self, org_id: String) -> Self {
        self.org_id = Some(org_id);
        self
    }

    pub fn with_project(mut self, project_id: String) -> Self {
        self.project_id = Some(project_id);
        self
    }
}

/// License information for an account
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicenseInfo {
    pub account_id: String,
    pub module_licenses: HashMap<ModuleType, bool>,
    pub is_valid: bool,
}

/// Authentication session information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthSession {
    pub principal: Principal,
    pub token: String,
    pub expires_at: Option<DateTime<Utc>>,
}

/// Principal information for authentication
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Principal {
    pub account_id: String,
    pub user_id: Option<String>,
    pub email: Option<String>,
    pub name: Option<String>,
}

/// Connector catalogue item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorCatalogueItem {
    pub category: Option<String>,
    #[serde(rename = "type")]
    pub connector_type: Option<String>,
    pub name: Option<String>,
    pub description: Option<String>,
    #[serde(rename = "logoURL")]
    pub logo_url: Option<String>,
    pub tags: Option<Vec<String>>,
    #[serde(rename = "harnessManaged")]
    pub harness_managed: Option<bool>,
    pub beta: Option<bool>,
    #[serde(rename = "comingSoon")]
    pub coming_soon: Option<bool>,
    #[serde(rename = "comingSoonDate")]
    pub coming_soon_date: Option<String>,
    #[serde(rename = "comingSoonDescription")]
    pub coming_soon_description: Option<String>,
    #[serde(rename = "isNew")]
    pub is_new: Option<bool>,
    #[serde(rename = "newUntil")]
    pub new_until: Option<DateTime<Utc>>,
    #[serde(rename = "supportedDelegateTypes")]
    pub supported_delegate_types: Option<Vec<DelegateType>>,
    #[serde(rename = "delegateSelectors")]
    pub delegate_selectors: Option<Vec<String>>,
    #[serde(rename = "delegateRequiresConnectivityMode")]
    pub delegate_requires_connectivity_mode: Option<bool>,
    #[serde(rename = "connectivityModes")]
    pub connectivity_modes: Option<Vec<ConnectivityMode>>,
    #[serde(rename = "documentationLink")]
    pub documentation_link: Option<String>,
    #[serde(rename = "isSSCA")]
    pub is_ssca: Option<bool>,
    #[serde(rename = "sscaDescription")]
    pub ssca_description: Option<String>,
    #[serde(rename = "sscaDocumentationLink")]
    pub ssca_documentation_link: Option<String>,
    #[serde(rename = "sscaType")]
    pub ssca_type: Option<String>,
    #[serde(rename = "sscaSupported")]
    pub ssca_supported: Option<bool>,
}

/// Connector details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorDetail {
    pub connector: Connector,
    pub created_at: Option<i64>,
    pub last_modified_at: Option<i64>,
    pub status: Option<ConnectorStatus>,
    pub activity_details: Option<ActivityDetails>,
    pub harness_managed: Option<bool>,
    pub git_sync_details: Option<GitSyncDetails>,
    pub entity_validity_details: Option<EntityValidityDetails>,
    pub governance_metadata: Option<GovernanceMetadata>,
}

/// Connector information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Connector {
    pub name: String,
    pub identifier: String,
    pub description: Option<String>,
    pub org_identifier: Option<String>,
    pub project_identifier: Option<String>,
    pub tags: Option<HashMap<String, String>>,
    #[serde(rename = "type")]
    pub connector_type: String,
    pub spec: serde_json::Value,
}

/// Connector status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorStatus {
    pub status: String,
    pub error_summary: Option<String>,
    pub errors: Option<Vec<ConnectorError>>,
    pub tested_at: Option<i64>,
    pub last_tested_at: Option<i64>,
    pub last_connected_at: Option<i64>,
}

/// Connector error
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorError {
    pub reason: Option<String>,
    pub message: Option<String>,
    pub code: Option<i32>,
}

/// Activity details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityDetails {
    pub last_activity_time: Option<i64>,
}

/// Git sync details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitSyncDetails {
    pub object_id: Option<String>,
    pub branch: Option<String>,
    pub repo_identifier: Option<String>,
    pub root_folder: Option<String>,
    pub file_path: Option<String>,
    pub is_new_branch: Option<bool>,
    pub base_branch: Option<String>,
}

/// Entity validity details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityValidityDetails {
    pub valid: Option<bool>,
    pub invalid_yaml: Option<String>,
}

/// Governance metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GovernanceMetadata {
    pub id: Option<String>,
    pub deny: Option<bool>,
    pub details: Option<serde_json::Value>,
}

/// Pipeline information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pipeline {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    pub tags: Option<HashMap<String, String>>,
    pub version: Option<i64>,
    pub git_details: Option<GitDetails>,
    pub entity_validity_details: Option<EntityValidityDetails>,
    pub template: Option<bool>,
    pub is_draft: Option<bool>,
    pub yaml: Option<String>,
}

/// Git details for entities
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitDetails {
    pub object_id: Option<String>,
    pub branch: Option<String>,
    pub repo_identifier: Option<String>,
    pub root_folder: Option<String>,
    pub file_path: Option<String>,
    pub repo_name: Option<String>,
    pub commit_id: Option<String>,
    pub file_url: Option<String>,
    pub repo_url: Option<String>,
}

/// Pipeline execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineExecution {
    pub plan_execution_id: String,
    pub run_sequence: Option<i32>,
    pub pipeline_identifier: String,
    pub name: Option<String>,
    pub status: ExecutionStatus,
    pub created_at: Option<i64>,
    pub start_ts: Option<i64>,
    pub end_ts: Option<i64>,
    pub tags: Option<Vec<ExecutionTag>>,
    pub execution_trigger_info: Option<ExecutionTriggerInfo>,
    pub execution_input_configured: Option<bool>,
    pub git_details: Option<GitDetails>,
    pub modules_info: Option<HashMap<String, serde_json::Value>>,
    pub layout_node_map: Option<HashMap<String, serde_json::Value>>,
    pub stages: Option<Vec<serde_json::Value>>,
    pub execution_url: Option<String>,
}

/// Execution tag
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionTag {
    pub key: String,
    pub value: String,
}

/// Execution trigger information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionTriggerInfo {
    pub trigger_type: Option<String>,
    pub triggered_by: Option<TriggeredBy>,
    pub is_rerun: Option<bool>,
    pub rerun_info: Option<RerunInfo>,
}

/// Information about who triggered the execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TriggeredBy {
    pub uuid: Option<String>,
    pub identifier: Option<String>,
    pub extra_info: Option<HashMap<String, String>>,
}

/// Rerun information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RerunInfo {
    pub prev_execution_id: Option<String>,
    pub root_execution_id: Option<String>,
}

/// Pull request information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PullRequest {
    pub number: i32,
    pub title: String,
    pub description: Option<String>,
    pub state: PullRequestState,
    pub author: Option<User>,
    pub source_branch: String,
    pub target_branch: String,
    pub created: Option<i64>,
    pub updated: Option<i64>,
    pub merged: Option<i64>,
    pub closed: Option<i64>,
    pub merge_check_status: Option<String>,
    pub conflict_check_status: Option<String>,
    pub is_draft: Option<bool>,
    pub stats: Option<PullRequestStats>,
}

/// Pull request statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PullRequestStats {
    pub conversations: Option<i32>,
    pub unresolved_count: Option<i32>,
    pub commits: Option<i32>,
    pub files_changed: Option<i32>,
    pub additions: Option<i32>,
    pub deletions: Option<i32>,
}

/// User information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: Option<i64>,
    pub uid: Option<String>,
    pub display_name: Option<String>,
    pub email: Option<String>,
    pub type_: Option<String>,
    pub created: Option<i64>,
    pub updated: Option<i64>,
}

/// Repository information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Repository {
    pub id: Option<i64>,
    pub identifier: String,
    pub path: String,
    pub description: Option<String>,
    pub is_public: Option<bool>,
    pub created: Option<i64>,
    pub updated: Option<i64>,
    pub size: Option<i64>,
    pub git_url: Option<String>,
    pub default_branch: Option<String>,
}

/// Generic API response wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub status: String,
    pub code: Option<String>,
    pub message: Option<String>,
    pub correlation_id: Option<String>,
    pub data: Option<T>,
}

/// Error response from Harness API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiError {
    pub status: String,
    pub code: Option<String>,
    pub message: String,
    pub correlation_id: Option<String>,
    pub details: Option<serde_json::Value>,
}

/// Pagination information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageInfo {
    pub page: Option<i32>,
    pub limit: Option<i32>,
    pub total_pages: Option<i32>,
    pub total_items: Option<i64>,
    pub item_count: Option<i32>,
}

/// Paginated response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginatedResponse<T> {
    pub content: Vec<T>,
    pub page_info: Option<PageInfo>,
    pub empty: Option<bool>,
}

/// Tool parameter validation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolParameter {
    pub name: String,
    pub description: String,
    pub required: bool,
    pub parameter_type: String,
    pub default_value: Option<serde_json::Value>,
}

/// Tool definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    pub parameters: Vec<ToolParameter>,
    pub category: Option<String>,
    pub tags: Option<Vec<String>>,
}

/// Utility functions for time conversion
pub fn format_unix_millis_to_rfc3339(ms: i64) -> Option<String> {
    if ms <= 0 {
        return None;
    }
    
    let dt = DateTime::from_timestamp(ms / 1000, ((ms % 1000) * 1_000_000) as u32)?;
    Some(dt.to_rfc3339())
}

pub fn parse_rfc3339_to_unix_millis(rfc3339: &str) -> Option<i64> {
    let dt = DateTime::parse_from_rfc3339(rfc3339).ok()?;
    Some(dt.timestamp_millis())
}