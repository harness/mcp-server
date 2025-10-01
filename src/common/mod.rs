use serde::{Deserialize, Serialize};

/// Common response structure for Harness APIs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HarnessResponse<T> {
    pub status: String,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T> HarnessResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            status: "SUCCESS".to_string(),
            data: Some(data),
            error: None,
        }
    }
    
    pub fn error(error: String) -> Self {
        Self {
            status: "ERROR".to_string(),
            data: None,
            error: Some(error),
        }
    }
}

/// Pagination information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageResponse<T> {
    #[serde(rename = "totalPages")]
    pub total_pages: i64,
    #[serde(rename = "totalItems")]
    pub total_items: i64,
    #[serde(rename = "pageItemCount")]
    pub page_item_count: i64,
    #[serde(rename = "pageSize")]
    pub page_size: i64,
    pub content: Vec<T>,
}

/// Common entity fields
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityMetadata {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    pub tags: std::collections::HashMap<String, String>,
    pub version: Option<i64>,
}