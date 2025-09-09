use serde::{Deserialize, Serialize};
use std::collections::HashMap;

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
    pub new_until: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(rename = "supportedDelegateTypes")]
    pub supported_delegate_types: Option<Vec<String>>,
    #[serde(rename = "delegateSelectors")]
    pub delegate_selectors: Option<Vec<String>>,
    #[serde(rename = "delegateRequiresConnectivityMode")]
    pub delegate_requires_connectivity_mode: Option<bool>,
    #[serde(rename = "connectivityModes")]
    pub connectivity_modes: Option<Vec<String>>,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorDetail {
    pub connector: Connector,
    pub created_at: Option<i64>,
    pub last_modified_at: Option<i64>,
    pub status: Option<ConnectorStatus>,
    pub activity_details: Option<ActivityDetails>,
    pub harness_managed: Option<bool>,
    pub git_details: Option<GitDetails>,
    pub entity_validity_details: Option<EntityValidityDetails>,
    pub governance_metadata: Option<GovernanceMetadata>,
}

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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorStatus {
    pub status: String,
    pub errors_summary: Option<String>,
    pub last_tested_at: Option<i64>,
    pub last_connected_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityDetails {
    pub last_activity_time: Option<i64>,
}

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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityValidityDetails {
    pub valid: bool,
    pub invalid_yaml: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GovernanceMetadata {
    pub id: Option<String>,
    pub deny: Option<bool>,
    pub details: Option<Vec<GovernanceDetail>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GovernanceDetail {
    pub policy_id: Option<String>,
    pub policy_name: Option<String>,
    pub status: Option<String>,
    pub deny: Option<bool>,
}
