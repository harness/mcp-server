use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Environment data structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Environment {
    #[serde(rename = "identifier", skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(rename = "orgIdentifier", skip_serializing_if = "Option::is_none")]
    pub org_identifier: Option<String>,
    #[serde(rename = "projectIdentifier", skip_serializing_if = "Option::is_none")]
    pub project_identifier: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub environment_type: Option<String>, // e.g., "PreProduction", "Production"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<HashMap<String, String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub yaml: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub variables: Option<Vec<HashMap<String, serde_json::Value>>>,
    #[serde(rename = "gitOpsEnabled", skip_serializing_if = "Option::is_none")]
    pub git_ops_enabled: Option<bool>,
    #[serde(rename = "createdAt", skip_serializing_if = "Option::is_none")]
    pub created_at: Option<i64>,
    #[serde(rename = "lastModifiedAt", skip_serializing_if = "Option::is_none")]
    pub last_modified_at: Option<i64>,
}

/// Environment response wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Environment>,
}

/// Environment list response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentListResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<EnvironmentListData>,
}

/// Environment list data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentListData {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<Vec<Environment>>,
    #[serde(rename = "totalPages", skip_serializing_if = "Option::is_none")]
    pub total_pages: Option<i32>,
    #[serde(rename = "totalElements", skip_serializing_if = "Option::is_none")]
    pub total_elements: Option<i32>,
    #[serde(rename = "pageSize", skip_serializing_if = "Option::is_none")]
    pub page_size: Option<i32>,
    #[serde(rename = "pageIndex", skip_serializing_if = "Option::is_none")]
    pub page_index: Option<i32>,
}

/// Environment listing options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sort: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub order: Option<String>,
    #[serde(rename = "searchTerm", skip_serializing_if = "Option::is_none")]
    pub search_term: Option<String>,
    #[serde(rename = "environmentType", skip_serializing_if = "Option::is_none")]
    pub environment_type: Option<String>,
}

/// Move configuration type enumeration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MoveConfigType {
    #[serde(rename = "INLINE_TO_REMOTE")]
    InlineToRemote,
    #[serde(rename = "REMOTE_TO_INLINE")]
    RemoteToInline,
}

/// Move configuration request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoveConfigRequest {
    #[serde(rename = "moveConfigOperationType")]
    pub move_config_operation_type: MoveConfigType,
    #[serde(rename = "connectorRef", skip_serializing_if = "Option::is_none")]
    pub connector_ref: Option<String>,
    #[serde(rename = "repoName", skip_serializing_if = "Option::is_none")]
    pub repo_name: Option<String>,
    #[serde(rename = "branch", skip_serializing_if = "Option::is_none")]
    pub branch: Option<String>,
    #[serde(rename = "filePath", skip_serializing_if = "Option::is_none")]
    pub file_path: Option<String>,
    #[serde(rename = "commitMsg", skip_serializing_if = "Option::is_none")]
    pub commit_msg: Option<String>,
    #[serde(rename = "isNewBranch", skip_serializing_if = "Option::is_none")]
    pub is_new_branch: Option<bool>,
    #[serde(rename = "baseBranch", skip_serializing_if = "Option::is_none")]
    pub base_branch: Option<String>,
}