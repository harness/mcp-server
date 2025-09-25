pub mod common;
pub mod pipeline;
pub mod service;
pub mod connector;
pub mod environment;
pub mod infrastructure;
pub mod dashboard;
pub mod template;

use serde::{Deserialize, Serialize};

/// Generic response wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub status: Option<String>,
    pub data: Option<T>,
    pub message: Option<String>,
    pub code: Option<String>,
}

/// Generic list response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListResponse<T> {
    pub status: Option<String>,
    pub data: Option<ListData<T>>,
}

/// List data structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListData<T> {
    pub content: Vec<T>,
    #[serde(rename = "totalElements")]
    pub total_elements: Option<i64>,
    #[serde(rename = "totalPages")]
    pub total_pages: Option<i32>,
    #[serde(rename = "pageSize")]
    pub page_size: Option<i32>,
    #[serde(rename = "pageIndex")]
    pub page_index: Option<i32>,
    pub empty: Option<bool>,
    pub first: Option<bool>,
    pub last: Option<bool>,
}

/// Pagination parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginationParams {
    pub page: Option<i32>,
    pub size: Option<i32>,
    pub sort: Option<String>,
}

impl Default for PaginationParams {
    fn default() -> Self {
        Self {
            page: Some(0),
            size: Some(20),
            sort: None,
        }
    }
}