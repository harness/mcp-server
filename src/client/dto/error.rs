//! Error DTOs for API responses

use serde::{Deserialize, Serialize};

/// Standard API error response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiError {
    pub code: String,
    pub message: String,
    pub details: Option<serde_json::Value>,
}

/// Error response wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub status: String,
    pub error: ApiError,
}