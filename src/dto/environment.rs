use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use super::common::{GitDetails, EntityValidityDetails};

/// Environment representation in Harness
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
    pub description: Option<String>,
    pub color: Option<String>,
    #[serde(rename = "type")]
    pub env_type: String,
    pub deleted: Option<bool>,
    pub tags: Option<HashMap<String, String>>,
    pub version: Option<i64>,
    #[serde(rename = "gitDetails")]
    pub git_details: Option<GitDetails>,
    #[serde(rename = "entityValidityDetails")]
    pub entity_validity_details: Option<EntityValidityDetails>,
    pub yaml: Option<String>,
}

/// Environment group representation
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
    pub description: Option<String>,
    pub color: Option<String>,
    pub tags: Option<HashMap<String, String>>,
    #[serde(rename = "envIdentifiers")]
    pub env_identifiers: Option<Vec<String>>,
    pub yaml: Option<String>,
}

/// Environment input for creation/update
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentInput {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
    #[serde(rename = "type")]
    pub env_type: String,
    pub tags: Option<HashMap<String, String>>,
    pub yaml: Option<String>,
}

/// Environment filter options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentFilterOptions {
    #[serde(rename = "envIdentifiers")]
    pub env_identifiers: Option<Vec<String>>,
    #[serde(rename = "envNames")]
    pub env_names: Option<Vec<String>>,
    pub description: Option<String>,
    #[serde(rename = "envTypes")]
    pub env_types: Option<Vec<String>>,
    pub tags: Option<HashMap<String, String>>,
    #[serde(rename = "filterType")]
    pub filter_type: Option<String>,
}