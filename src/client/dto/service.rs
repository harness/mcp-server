//! Service DTOs

use serde::{Deserialize, Serialize};

/// Service information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Service {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    pub tags: std::collections::HashMap<String, String>,
}

/// Service list response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceListResponse {
    pub status: String,
    pub data: Option<ServiceListData>,
}

/// Service list data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceListData {
    pub content: Vec<Service>,
    pub total_elements: i64,
}