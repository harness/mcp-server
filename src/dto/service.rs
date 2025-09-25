use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Service representation in Harness
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Service {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "orgIdentifier")]
    pub org_identifier: String,
    #[serde(rename = "projectIdentifier")]
    pub project_identifier: String,
    pub yaml: Option<String>,
    pub tags: Option<HashMap<String, String>>,
    pub variables: Option<Vec<HashMap<String, serde_json::Value>>>,
    #[serde(rename = "gitOpsEnabled")]
    pub git_ops_enabled: Option<bool>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<i64>,
    #[serde(rename = "lastModifiedAt")]
    pub last_modified_at: Option<i64>,
}

/// Service options for listing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceOptions {
    pub page: Option<i32>,
    pub limit: Option<i32>,
    pub sort: Option<String>,
    pub order: Option<String>,
}