use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Common scope information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Scope {
    #[serde(rename = "accountIdentifier")]
    pub account_id: String,
    #[serde(rename = "orgIdentifier")]
    pub org_id: Option<String>,
    #[serde(rename = "projectIdentifier")]
    pub project_id: Option<String>,
}

/// Common entity metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityMetadata {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    pub tags: Option<HashMap<String, String>>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<i64>,
    #[serde(rename = "lastModifiedAt")]
    pub last_modified_at: Option<i64>,
}

/// Git details for entities
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitDetails {
    pub valid: Option<bool>,
    #[serde(rename = "invalidYaml")]
    pub invalid_yaml: Option<String>,
    #[serde(rename = "repoIdentifier")]
    pub repo_identifier: Option<String>,
    pub branch: Option<String>,
    #[serde(rename = "filePath")]
    pub file_path: Option<String>,
}

/// Entity validity details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityValidityDetails {
    pub valid: Option<bool>,
    #[serde(rename = "invalidYaml")]
    pub invalid_yaml: Option<String>,
}

/// Sort information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SortInfo {
    pub sorted: Option<bool>,
    pub unsorted: Option<bool>,
    pub empty: Option<bool>,
}

/// Pageable information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageableInfo {
    pub sort: Option<SortInfo>,
    #[serde(rename = "pageNumber")]
    pub page_number: Option<i32>,
    #[serde(rename = "pageSize")]
    pub page_size: Option<i32>,
    pub offset: Option<i64>,
    pub paged: Option<bool>,
    pub unpaged: Option<bool>,
}

/// Page information for pagination
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageInfo {
    #[serde(rename = "pageIndex")]
    pub page_index: i32,
    #[serde(rename = "pageSize")]
    pub page_size: i32,
    #[serde(rename = "totalPages")]
    pub total_pages: i32,
    #[serde(rename = "totalItems")]
    pub total_items: i64,
    #[serde(rename = "hasMore")]
    pub has_more: bool,
}