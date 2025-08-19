// Error types for Harness MCP Server
// Migrated from Go error handling to Rust Result types

use thiserror::Error;
use serde::{Deserialize, Serialize};

#[derive(Error, Debug)]
pub enum HarnessError {
    #[error("Authentication failed: {message}")]
    AuthenticationError { message: String },
    
    #[error("API request failed: {status_code} - {message}")]
    ApiError { status_code: u16, message: String },
    
    #[error("Invalid configuration: {field} - {message}")]
    ConfigurationError { field: String, message: String },
    
    #[error("Tool execution failed: {tool_name} - {message}")]
    ToolExecutionError { tool_name: String, message: String },
    
    #[error("Validation failed: {message}")]
    ValidationError { message: String },
    
    #[error("Resource not found: {resource_type} with id '{id}'")]
    NotFoundError { resource_type: String, id: String },
    
    #[error("Permission denied: {message}")]
    PermissionDeniedError { message: String },
    
    #[error("Rate limit exceeded: {message}")]
    RateLimitError { message: String },
    
    #[error("Network error: {message}")]
    NetworkError { message: String },
    
    #[error("Serialization error: {message}")]
    SerializationError { message: String },
    
    #[error("Internal server error: {message}")]
    InternalError { message: String },
    
    #[error("HTTP client error: {0}")]
    HttpClientError(#[from] reqwest::Error),
    
    #[error("JSON parsing error: {0}")]
    JsonError(#[from] serde_json::Error),
    
    #[error("JWT token error: {0}")]
    JwtError(#[from] jsonwebtoken::errors::Error),
    
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    
    #[error("Generic error: {0}")]
    GenericError(#[from] anyhow::Error),
}

// API Error response structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiErrorResponse {
    pub status: String,
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub correlation_id: Option<String>,
}

// Result type alias for convenience
pub type HarnessResult<T> = Result<T, HarnessError>;

impl HarnessError {
    pub fn authentication(message: impl Into<String>) -> Self {
        Self::AuthenticationError {
            message: message.into(),
        }
    }
    
    pub fn api_error(status_code: u16, message: impl Into<String>) -> Self {
        Self::ApiError {
            status_code,
            message: message.into(),
        }
    }
    
    pub fn configuration(field: impl Into<String>, message: impl Into<String>) -> Self {
        Self::ConfigurationError {
            field: field.into(),
            message: message.into(),
        }
    }
    
    pub fn tool_execution(tool_name: impl Into<String>, message: impl Into<String>) -> Self {
        Self::ToolExecutionError {
            tool_name: tool_name.into(),
            message: message.into(),
        }
    }
    
    pub fn validation(message: impl Into<String>) -> Self {
        Self::ValidationError {
            message: message.into(),
        }
    }
    
    pub fn not_found(resource_type: impl Into<String>, id: impl Into<String>) -> Self {
        Self::NotFoundError {
            resource_type: resource_type.into(),
            id: id.into(),
        }
    }
    
    pub fn permission_denied(message: impl Into<String>) -> Self {
        Self::PermissionDeniedError {
            message: message.into(),
        }
    }
    
    pub fn rate_limit(message: impl Into<String>) -> Self {
        Self::RateLimitError {
            message: message.into(),
        }
    }
    
    pub fn network(message: impl Into<String>) -> Self {
        Self::NetworkError {
            message: message.into(),
        }
    }
    
    pub fn serialization(message: impl Into<String>) -> Self {
        Self::SerializationError {
            message: message.into(),
        }
    }
    
    pub fn internal(message: impl Into<String>) -> Self {
        Self::InternalError {
            message: message.into(),
        }
    }
}

// Convert HTTP status codes to appropriate errors
impl From<reqwest::StatusCode> for HarnessError {
    fn from(status: reqwest::StatusCode) -> Self {
        match status {
            reqwest::StatusCode::UNAUTHORIZED => {
                Self::authentication("Invalid or expired authentication credentials")
            }
            reqwest::StatusCode::FORBIDDEN => {
                Self::permission_denied("Insufficient permissions for this operation")
            }
            reqwest::StatusCode::NOT_FOUND => {
                Self::not_found("Resource", "unknown")
            }
            reqwest::StatusCode::TOO_MANY_REQUESTS => {
                Self::rate_limit("API rate limit exceeded")
            }
            status if status.is_client_error() => {
                Self::api_error(status.as_u16(), format!("Client error: {}", status))
            }
            status if status.is_server_error() => {
                Self::api_error(status.as_u16(), format!("Server error: {}", status))
            }
            status => {
                Self::api_error(status.as_u16(), format!("Unexpected status: {}", status))
            }
        }
    }
}