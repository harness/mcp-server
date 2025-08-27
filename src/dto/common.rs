use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Generic entity wrapper for API responses
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entity<T> {
    pub data: T,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Pagination information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageInfo {
    pub page: i32,
    pub size: i32,
    pub has_next: bool,
    pub has_prev: bool,
}

/// Standard API response wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub status: String,
    pub data: T,
    #[serde(rename = "metaData")]
    pub meta_data: Option<serde_json::Value>,
    #[serde(rename = "correlationId")]
    pub correlation_id: String,
}

/// Error details in API responses
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiError {
    pub reason: String,
    pub message: String,
    pub code: i32,
}

/// Activity details with timestamps
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityDetails {
    #[serde(rename = "lastActivityTime")]
    pub last_activity_time: i64,
}

/// Git-related details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitDetails {
    pub valid: bool,
    #[serde(rename = "invalidYaml")]
    pub invalid_yaml: Option<String>,
}

/// Entity validity information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityValidityDetails {
    pub valid: bool,
    #[serde(rename = "invalidYaml")]
    pub invalid_yaml: Option<String>,
}

/// Convert Unix timestamp in milliseconds to RFC3339 format
pub fn format_unix_millis_to_rfc3339(ms: i64) -> String {
    if ms <= 0 {
        return String::new();
    }
    
    let secs = ms / 1000;
    let nanos = ((ms % 1000) * 1_000_000) as u32;
    
    match chrono::DateTime::from_timestamp(secs, nanos) {
        Some(dt) => dt.to_rfc3339(),
        None => String::new(),
    }
}