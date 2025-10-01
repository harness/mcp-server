use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum HarnessError {
    #[error("Authentication failed: {0}")]
    Authentication(String),
    
    #[error("Authorization failed: {0}")]
    Authorization(String),
    
    #[error("Configuration error: {0}")]
    Configuration(String),
    
    #[error("MCP protocol error: {0}")]
    McpProtocol(String),
    
    #[error("HTTP client error: {0}")]
    HttpClient(#[from] reqwest::Error),
    
    #[error("JSON serialization error: {0}")]
    JsonSerialization(#[from] serde_json::Error),
    
    #[error("JWT error: {0}")]
    Jwt(#[from] jsonwebtoken::errors::Error),
    
    #[error("Invalid parameter: {field}")]
    InvalidParameter { field: String },
    
    #[error("Missing required parameter: {field}")]
    MissingParameter { field: String },
    
    #[error("Service unavailable: {service}")]
    ServiceUnavailable { service: String },
    
    #[error("Rate limit exceeded")]
    RateLimit,
    
    #[error("Internal server error: {0}")]
    Internal(String),
    
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Timeout error: {0}")]
    Timeout(String),
}

impl HarnessError {
    pub fn status_code(&self) -> StatusCode {
        match self {
            HarnessError::Authentication(_) => StatusCode::UNAUTHORIZED,
            HarnessError::Authorization(_) => StatusCode::FORBIDDEN,
            HarnessError::Configuration(_) => StatusCode::BAD_REQUEST,
            HarnessError::InvalidParameter { .. } => StatusCode::BAD_REQUEST,
            HarnessError::MissingParameter { .. } => StatusCode::BAD_REQUEST,
            HarnessError::RateLimit => StatusCode::TOO_MANY_REQUESTS,
            HarnessError::ServiceUnavailable { .. } => StatusCode::SERVICE_UNAVAILABLE,
            HarnessError::Timeout(_) => StatusCode::REQUEST_TIMEOUT,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
    
    pub fn error_code(&self) -> i32 {
        match self {
            HarnessError::Authentication(_) => -32001,
            HarnessError::Authorization(_) => -32002,
            HarnessError::InvalidParameter { .. } => -32602,
            HarnessError::MissingParameter { .. } => -32602,
            HarnessError::McpProtocol(_) => -32603,
            _ => -32603, // Internal error
        }
    }
}

impl IntoResponse for HarnessError {
    fn into_response(self) -> Response {
        let status = self.status_code();
        let error_message = self.to_string();
        
        let body = Json(json!({
            "jsonrpc": "2.0",
            "error": {
                "code": self.error_code(),
                "message": format!("Internal error: {}", error_message)
            },
            "id": null
        }));
        
        (status, body).into_response()
    }
}

pub type Result<T> = std::result::Result<T, HarnessError>;

// Helper functions for common error patterns
pub fn missing_parameter(field: &str) -> HarnessError {
    HarnessError::MissingParameter {
        field: field.to_string(),
    }
}

pub fn invalid_parameter(field: &str) -> HarnessError {
    HarnessError::InvalidParameter {
        field: field.to_string(),
    }
}

pub fn authentication_error(msg: &str) -> HarnessError {
    HarnessError::Authentication(msg.to_string())
}

pub fn authorization_error(msg: &str) -> HarnessError {
    HarnessError::Authorization(msg.to_string())
}

pub fn internal_error(msg: &str) -> HarnessError {
    HarnessError::Internal(msg.to_string())
}

pub fn service_unavailable(service: &str) -> HarnessError {
    HarnessError::ServiceUnavailable {
        service: service.to_string(),
    }
}