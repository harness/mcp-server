//! Environment DTOs

use serde::{Deserialize, Serialize};

/// Environment information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Environment {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    pub tags: std::collections::HashMap<String, String>,
    pub environment_type: EnvironmentType,
}

/// Environment type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EnvironmentType {
    Production,
    PreProduction,
}

/// Environment list response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentListResponse {
    pub status: String,
    pub data: Option<EnvironmentListData>,
}

/// Environment list data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentListData {
    pub content: Vec<Environment>,
    pub total_elements: i64,
}