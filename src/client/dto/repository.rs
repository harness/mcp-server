//! Repository DTOs

use serde::{Deserialize, Serialize};

/// Repository information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Repository {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    pub url: String,
    pub default_branch: String,
}

/// Repository list response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepositoryListResponse {
    pub status: String,
    pub data: Option<RepositoryListData>,
}

/// Repository list data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepositoryListData {
    pub content: Vec<Repository>,
    pub total_elements: i64,
}