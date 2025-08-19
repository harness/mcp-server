// Data Transfer Objects for Harness API responses
// Contains structs that mirror the Go DTOs

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use chrono::{DateTime, Utc};

// Connector-related DTOs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorCatalogueItem {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub r#type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(rename = "logoURL", skip_serializing_if = "Option::is_none")]
    pub logo_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
    #[serde(rename = "harnessManaged", skip_serializing_if = "Option::is_none")]
    pub harness_managed: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub beta: Option<bool>,
    #[serde(rename = "comingSoon", skip_serializing_if = "Option::is_none")]
    pub coming_soon: Option<bool>,
    #[serde(rename = "comingSoonDate", skip_serializing_if = "Option::is_none")]
    pub coming_soon_date: Option<String>,
    #[serde(rename = "comingSoonDescription", skip_serializing_if = "Option::is_none")]
    pub coming_soon_description: Option<String>,
    #[serde(rename = "isNew", skip_serializing_if = "Option::is_none")]
    pub is_new: Option<bool>,
    #[serde(rename = "newUntil", skip_serializing_if = "Option::is_none")]
    pub new_until: Option<DateTime<Utc>>,
    #[serde(rename = "supportedDelegateTypes", skip_serializing_if = "Option::is_none")]
    pub supported_delegate_types: Option<Vec<String>>,
    #[serde(rename = "delegateSelectors", skip_serializing_if = "Option::is_none")]
    pub delegate_selectors: Option<Vec<String>>,
    #[serde(rename = "delegateRequiresConnectivityMode", skip_serializing_if = "Option::is_none")]
    pub delegate_requires_connectivity_mode: Option<bool>,
    #[serde(rename = "connectivityModes", skip_serializing_if = "Option::is_none")]
    pub connectivity_modes: Option<Vec<String>>,
    #[serde(rename = "documentationLink", skip_serializing_if = "Option::is_none")]
    pub documentation_link: Option<String>,
    #[serde(rename = "isSSCA", skip_serializing_if = "Option::is_none")]
    pub is_ssca: Option<bool>,
    #[serde(rename = "sscaDescription", skip_serializing_if = "Option::is_none")]
    pub ssca_description: Option<String>,
    #[serde(rename = "sscaDocumentationLink", skip_serializing_if = "Option::is_none")]
    pub ssca_documentation_link: Option<String>,
    #[serde(rename = "sscaType", skip_serializing_if = "Option::is_none")]
    pub ssca_type: Option<String>,
    #[serde(rename = "sscaSupported", skip_serializing_if = "Option::is_none")]
    pub ssca_supported: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorDetail {
    pub connector: Connector,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "lastModifiedAt")]
    pub last_modified_at: i64,
    pub status: ConnectorStatus,
    #[serde(rename = "activityDetails")]
    pub activity_details: ActivityDetails,
    #[serde(rename = "harnessManaged")]
    pub harness_managed: bool,
    #[serde(rename = "gitDetails")]
    pub git_details: GitDetails,
    #[serde(rename = "entityValidityDetails")]
    pub entity_validity_details: EntityValidityDetails,
    #[serde(rename = "governanceMetadata", skip_serializing_if = "Option::is_none")]
    pub governance_metadata: Option<serde_json::Value>,
    #[serde(rename = "isFavorite")]
    pub is_favorite: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Connector {
    pub name: String,
    pub identifier: String,
    pub description: String,
    #[serde(rename = "accountIdentifier")]
    pub account_identifier: String,
    #[serde(rename = "orgIdentifier")]
    pub org_identifier: String,
    #[serde(rename = "projectIdentifier")]
    pub project_identifier: String,
    pub tags: HashMap<String, String>,
    pub r#type: String,
    pub spec: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityValidityDetails {
    pub valid: bool,
    #[serde(rename = "invalidYaml")]
    pub invalid_yaml: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorStatus {
    pub status: String,
    #[serde(rename = "errorSummary")]
    pub error_summary: String,
    pub errors: Vec<ConnectorError>,
    #[serde(rename = "testedAt")]
    pub tested_at: i64,
    #[serde(rename = "lastTestedAt")]
    pub last_tested_at: i64,
    #[serde(rename = "lastConnectedAt")]
    pub last_connected_at: i64,
    #[serde(rename = "lastAlertSent")]
    pub last_alert_sent: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorError {
    pub reason: String,
    pub message: String,
    pub code: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityDetails {
    #[serde(rename = "lastActivityTime")]
    pub last_activity_time: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitDetails {
    pub valid: bool,
    #[serde(rename = "invalidYaml")]
    pub invalid_yaml: String,
}

// Pipeline-related DTOs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pipeline {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    pub tags: Option<HashMap<String, String>>,
    pub yaml: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineExecution {
    #[serde(rename = "planExecutionId")]
    pub plan_execution_id: String,
    pub status: String,
    #[serde(rename = "startTs")]
    pub start_ts: Option<i64>,
    #[serde(rename = "endTs")]
    pub end_ts: Option<i64>,
    #[serde(rename = "pipelineIdentifier")]
    pub pipeline_identifier: String,
}

// Repository-related DTOs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Repository {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "defaultBranch")]
    pub default_branch: Option<String>,
    pub r#type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PullRequest {
    pub number: i32,
    pub title: String,
    pub description: Option<String>,
    pub state: String,
    #[serde(rename = "sourceBranch")]
    pub source_branch: String,
    #[serde(rename = "targetBranch")]
    pub target_branch: String,
    pub author: String,
}

// Service-related DTOs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Service {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    pub tags: Option<HashMap<String, String>>,
}

// Environment-related DTOs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Environment {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    pub r#type: String,
    pub tags: Option<HashMap<String, String>>,
}

// Infrastructure-related DTOs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Infrastructure {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    pub r#type: String,
    pub environment_ref: String,
}

// Common response wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub status: String,
    pub data: T,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
}

// Pagination support
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageResponse<T> {
    pub content: Vec<T>,
    #[serde(rename = "totalElements")]
    pub total_elements: i64,
    #[serde(rename = "totalPages")]
    pub total_pages: i32,
    pub size: i32,
    pub number: i32,
    pub first: bool,
    pub last: bool,
}

// Scope for API calls
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Scope {
    #[serde(rename = "accountIdentifier")]
    pub account_identifier: String,
    #[serde(rename = "orgIdentifier", skip_serializing_if = "Option::is_none")]
    pub org_identifier: Option<String>,
    #[serde(rename = "projectIdentifier", skip_serializing_if = "Option::is_none")]
    pub project_identifier: Option<String>,
}