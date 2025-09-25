//! Common data transfer objects

use serde::{Deserialize, Serialize};

/// Pagination options for list requests
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginationOptions {
    pub page: Option<i32>,
    pub size: Option<i32>,
}

/// Standard API response wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub data: T,
    pub status: String,
}

/// Standard list response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListResponse<T> {
    pub content: Vec<T>,
    pub total_pages: Option<i32>,
    pub total_elements: Option<i64>,
    pub page_size: Option<i32>,
    pub page_index: Option<i32>,
}

/// Scope information for Harness resources
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Scope {
    pub account_id: String,
    pub org_id: Option<String>,
    pub project_id: Option<String>,
}