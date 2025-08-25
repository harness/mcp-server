use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Service data structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Service {
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
    pub yaml: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<HashMap<String, String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub variables: Option<Vec<HashMap<String, serde_json::Value>>>,
    #[serde(rename = "gitOpsEnabled", skip_serializing_if = "Option::is_none")]
    pub git_ops_enabled: Option<bool>,
    #[serde(rename = "createdAt", skip_serializing_if = "Option::is_none")]
    pub created_at: Option<i64>,
    #[serde(rename = "lastModifiedAt", skip_serializing_if = "Option::is_none")]
    pub last_modified_at: Option<i64>,
}

/// Service response wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Service>,
}

/// Service list response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceListResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<ServiceListData>,
}

/// Service list data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceListData {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<Vec<Service>>,
    #[serde(rename = "totalPages", skip_serializing_if = "Option::is_none")]
    pub total_pages: Option<i32>,
    #[serde(rename = "totalElements", skip_serializing_if = "Option::is_none")]
    pub total_elements: Option<i32>,
    #[serde(rename = "pageSize", skip_serializing_if = "Option::is_none")]
    pub page_size: Option<i32>,
    #[serde(rename = "pageIndex", skip_serializing_if = "Option::is_none")]
    pub page_index: Option<i32>,
}

/// Service listing options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceOptions {
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
}