// Service and Environment DTOs

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Service {
    #[serde(rename = "accountId")]
    pub account_id: String,
    #[serde(rename = "orgIdentifier")]
    pub org_identifier: String,
    #[serde(rename = "projectIdentifier")]
    pub project_identifier: String,
    pub identifier: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<HashMap<String, String>>,
    pub version: i64,
    #[serde(rename = "gitDetails", skip_serializing_if = "Option::is_none")]
    pub git_details: Option<GitDetails>,
    #[serde(rename = "yaml")]
    pub yaml_content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceDefinition {
    #[serde(rename = "type")]
    pub service_type: String,
    pub spec: ServiceSpec,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceSpec {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub manifests: Option<Vec<ManifestConfig>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub artifacts: Option<ArtifactConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub variables: Option<Vec<ServiceVariable>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManifestConfig {
    pub identifier: String,
    #[serde(rename = "type")]
    pub manifest_type: String,
    pub spec: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtifactConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub primary: Option<ArtifactSource>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sidecars: Option<Vec<ArtifactSource>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtifactSource {
    pub identifier: String,
    #[serde(rename = "type")]
    pub source_type: String,
    pub spec: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceVariable {
    pub name: String,
    #[serde(rename = "type")]
    pub variable_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(rename = "value")]
    pub default_value: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Environment {
    #[serde(rename = "accountId")]
    pub account_id: String,
    #[serde(rename = "orgIdentifier")]
    pub org_identifier: String,
    #[serde(rename = "projectIdentifier")]
    pub project_identifier: String,
    pub identifier: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(rename = "type")]
    pub environment_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<HashMap<String, String>>,
    pub version: i64,
    #[serde(rename = "gitDetails", skip_serializing_if = "Option::is_none")]
    pub git_details: Option<GitDetails>,
    #[serde(rename = "yaml")]
    pub yaml_content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentGroup {
    #[serde(rename = "accountId")]
    pub account_id: String,
    #[serde(rename = "orgIdentifier")]
    pub org_identifier: String,
    #[serde(rename = "projectIdentifier")]
    pub project_identifier: String,
    pub identifier: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<HashMap<String, String>>,
    #[serde(rename = "envIdentifiers")]
    pub env_identifiers: Vec<String>,
    pub version: i64,
    #[serde(rename = "gitDetails", skip_serializing_if = "Option::is_none")]
    pub git_details: Option<GitDetails>,
    #[serde(rename = "yaml")]
    pub yaml_content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Infrastructure {
    #[serde(rename = "accountId")]
    pub account_id: String,
    #[serde(rename = "orgIdentifier")]
    pub org_identifier: String,
    #[serde(rename = "projectIdentifier")]
    pub project_identifier: String,
    #[serde(rename = "environmentRef")]
    pub environment_ref: String,
    pub identifier: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<HashMap<String, String>>,
    #[serde(rename = "type")]
    pub infrastructure_type: String,
    #[serde(rename = "deploymentType")]
    pub deployment_type: String,
    pub version: i64,
    #[serde(rename = "gitDetails", skip_serializing_if = "Option::is_none")]
    pub git_details: Option<GitDetails>,
    #[serde(rename = "yaml")]
    pub yaml_content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitDetails {
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

// Request types

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceListRequest {
    #[serde(rename = "serviceNames", skip_serializing_if = "Option::is_none")]
    pub service_names: Option<Vec<String>>,
    #[serde(rename = "serviceIdentifiers", skip_serializing_if = "Option::is_none")]
    pub service_identifiers: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<HashMap<String, String>>,
    #[serde(rename = "filterType", skip_serializing_if = "Option::is_none")]
    pub filter_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentListRequest {
    #[serde(rename = "envNames", skip_serializing_if = "Option::is_none")]
    pub env_names: Option<Vec<String>>,
    #[serde(rename = "envIdentifiers", skip_serializing_if = "Option::is_none")]
    pub env_identifiers: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(rename = "envTypes", skip_serializing_if = "Option::is_none")]
    pub env_types: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<HashMap<String, String>>,
    #[serde(rename = "filterType", skip_serializing_if = "Option::is_none")]
    pub filter_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InfrastructureListRequest {
    #[serde(rename = "environmentIdentifier", skip_serializing_if = "Option::is_none")]
    pub environment_identifier: Option<String>,
    #[serde(rename = "infraIdentifiers", skip_serializing_if = "Option::is_none")]
    pub infra_identifiers: Option<Vec<String>>,
    #[serde(rename = "infraNames", skip_serializing_if = "Option::is_none")]
    pub infra_names: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(rename = "deploymentTypes", skip_serializing_if = "Option::is_none")]
    pub deployment_types: Option<Vec<String>>,
    #[serde(rename = "infraTypes", skip_serializing_if = "Option::is_none")]
    pub infra_types: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<HashMap<String, String>>,
    #[serde(rename = "filterType", skip_serializing_if = "Option::is_none")]
    pub filter_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoveConfigRequest {
    #[serde(rename = "moveConfigOperationType")]
    pub move_config_operation_type: String, // "INLINE_TO_REMOTE" or "REMOTE_TO_INLINE"
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