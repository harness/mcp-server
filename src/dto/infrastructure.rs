use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use super::common::{GitDetails, EntityValidityDetails};

/// Infrastructure definition representation
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
    pub description: Option<String>,
    pub tags: Option<HashMap<String, String>>,
    #[serde(rename = "type")]
    pub infra_type: String,
    #[serde(rename = "deploymentType")]
    pub deployment_type: String,
    pub yaml: Option<String>,
    #[serde(rename = "gitDetails")]
    pub git_details: Option<GitDetails>,
    #[serde(rename = "entityValidityDetails")]
    pub entity_validity_details: Option<EntityValidityDetails>,
    #[serde(rename = "storeType")]
    pub store_type: Option<String>,
    #[serde(rename = "connectorRef")]
    pub connector_ref: Option<String>,
}

/// Infrastructure input for creation/update
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InfrastructureInput {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "environmentRef")]
    pub environment_ref: String,
    pub tags: Option<HashMap<String, String>>,
    #[serde(rename = "type")]
    pub infra_type: String,
    #[serde(rename = "deploymentType")]
    pub deployment_type: String,
    pub yaml: Option<String>,
}

/// Infrastructure filter options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InfrastructureFilterOptions {
    #[serde(rename = "infraIdentifiers")]
    pub infra_identifiers: Option<Vec<String>>,
    #[serde(rename = "infraNames")]
    pub infra_names: Option<Vec<String>>,
    #[serde(rename = "envIdentifiers")]
    pub env_identifiers: Option<Vec<String>>,
    pub description: Option<String>,
    #[serde(rename = "infraTypes")]
    pub infra_types: Option<Vec<String>>,
    #[serde(rename = "deploymentTypes")]
    pub deployment_types: Option<Vec<String>>,
    pub tags: Option<HashMap<String, String>>,
    #[serde(rename = "filterType")]
    pub filter_type: Option<String>,
}

/// Infrastructure YAML move request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InfrastructureYamlMoveRequest {
    #[serde(rename = "moveConfigOperationType")]
    pub move_config_operation_type: String,
    #[serde(rename = "connectorRef")]
    pub connector_ref: Option<String>,
    #[serde(rename = "repoName")]
    pub repo_name: Option<String>,
    #[serde(rename = "branch")]
    pub branch: Option<String>,
    #[serde(rename = "filePath")]
    pub file_path: Option<String>,
    #[serde(rename = "commitMsg")]
    pub commit_msg: Option<String>,
    #[serde(rename = "isNewBranch")]
    pub is_new_branch: Option<bool>,
    #[serde(rename = "baseBranch")]
    pub base_branch: Option<String>,
}