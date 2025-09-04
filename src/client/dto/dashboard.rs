//! Dashboard DTOs

use serde::{Deserialize, Serialize};

/// Dashboard information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Dashboard {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub tags: Vec<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

/// Dashboard list response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardListResponse {
    pub status: String,
    pub data: Vec<Dashboard>,
}

/// Dashboard data response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardDataResponse {
    pub status: String,
    pub data: serde_json::Value,
}