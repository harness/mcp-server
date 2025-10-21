use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use time::OffsetDateTime;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ConnectorCatalogueItem {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub connector_type: Option<String>,
    
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
    pub new_until: Option<String>,
    
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

#[derive(Clone, Debug, Serialize, Deserialize)]
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
    pub git_details: ConnectorGitDetails,
    
    #[serde(rename = "entityValidityDetails")]
    pub entity_validity_details: ConnectorEntityValidityDetails,
    
    #[serde(rename = "governanceMetadata", skip_serializing_if = "Option::is_none")]
    pub governance_metadata: Option<serde_json::Value>,
    
    #[serde(rename = "isFavorite")]
    pub is_favorite: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ConnectorDetailResponse {
    pub connector: Connector,
    
    #[serde(rename = "created_at_time")]
    pub created_at_time: String,
    
    #[serde(rename = "last_modified_at_time")]
    pub last_modified_at_time: String,
    
    pub status: ConnectorStatusResponse,
    
    #[serde(rename = "activityDetails")]
    pub activity_details: ActivityDetailsResponse,
    
    #[serde(rename = "harnessManaged")]
    pub harness_managed: bool,
    
    #[serde(rename = "gitDetails")]
    pub git_details: ConnectorGitDetails,
    
    #[serde(rename = "entityValidityDetails")]
    pub entity_validity_details: ConnectorEntityValidityDetails,
    
    #[serde(rename = "governanceMetadata", skip_serializing_if = "Option::is_none")]
    pub governance_metadata: Option<serde_json::Value>,
    
    #[serde(rename = "isFavorite")]
    pub is_favorite: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
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
    
    #[serde(rename = "type")]
    pub connector_type: String,
    
    pub spec: HashMap<String, serde_json::Value>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ConnectorEntityValidityDetails {
    pub valid: bool,
    
    #[serde(rename = "invalidYaml")]
    pub invalid_yaml: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ConnectorStatus {
    pub status: String,
    
    #[serde(rename = "errorSummary", skip_serializing_if = "Option::is_none")]
    pub error_summary: Option<String>,
    
    #[serde(rename = "errors", skip_serializing_if = "Option::is_none")]
    pub errors: Option<Vec<ConnectorError>>,
    
    #[serde(rename = "testedAt", skip_serializing_if = "Option::is_none")]
    pub tested_at: Option<i64>,
    
    #[serde(rename = "lastTestedAt", skip_serializing_if = "Option::is_none")]
    pub last_tested_at: Option<i64>,
    
    #[serde(rename = "lastConnectedAt", skip_serializing_if = "Option::is_none")]
    pub last_connected_at: Option<i64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ConnectorStatusResponse {
    pub status: String,
    
    #[serde(rename = "errorSummary", skip_serializing_if = "Option::is_none")]
    pub error_summary: Option<String>,
    
    #[serde(rename = "errors", skip_serializing_if = "Option::is_none")]
    pub errors: Option<Vec<ConnectorError>>,
    
    #[serde(rename = "tested_at_time", skip_serializing_if = "Option::is_none")]
    pub tested_at_time: Option<String>,
    
    #[serde(rename = "last_tested_at_time", skip_serializing_if = "Option::is_none")]
    pub last_tested_at_time: Option<String>,
    
    #[serde(rename = "last_connected_at_time", skip_serializing_if = "Option::is_none")]
    pub last_connected_at_time: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ConnectorError {
    pub reason: String,
    pub message: String,
    pub code: i32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ActivityDetails {
    #[serde(rename = "lastActivityTime", skip_serializing_if = "Option::is_none")]
    pub last_activity_time: Option<i64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ActivityDetailsResponse {
    #[serde(rename = "last_activity_time", skip_serializing_if = "Option::is_none")]
    pub last_activity_time: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ConnectorGitDetails {
    #[serde(rename = "objectId", skip_serializing_if = "Option::is_none")]
    pub object_id: Option<String>,
    
    #[serde(rename = "branch", skip_serializing_if = "Option::is_none")]
    pub branch: Option<String>,
    
    #[serde(rename = "repoIdentifier", skip_serializing_if = "Option::is_none")]
    pub repo_identifier: Option<String>,
    
    #[serde(rename = "rootFolder", skip_serializing_if = "Option::is_none")]
    pub root_folder: Option<String>,
    
    #[serde(rename = "filePath", skip_serializing_if = "Option::is_none")]
    pub file_path: Option<String>,
    
    #[serde(rename = "repoName", skip_serializing_if = "Option::is_none")]
    pub repo_name: Option<String>,
    
    #[serde(rename = "commitId", skip_serializing_if = "Option::is_none")]
    pub commit_id: Option<String>,
    
    #[serde(rename = "fileUrl", skip_serializing_if = "Option::is_none")]
    pub file_url: Option<String>,
    
    #[serde(rename = "repoUrl", skip_serializing_if = "Option::is_none")]
    pub repo_url: Option<String>,
}