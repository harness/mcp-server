//! Service-related data transfer objects

use super::common::{ListResponse, PaginationOptions};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Service definition
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

/// Service list options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceListOptions {
    #[serde(flatten)]
    pub pagination: PaginationOptions,
    pub search_term: Option<String>,
    pub sort: Option<String>,
    pub order: Option<String>,
}

/// Service response wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceResponse {
    pub data: Service,
}

/// Service list response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceListResponse {
    pub data: ListResponse<Service>,
}