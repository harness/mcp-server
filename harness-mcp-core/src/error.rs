use thiserror::Error;

pub type Result<T> = std::result::Result<T, McpError>;

#[derive(Error, Debug)]
pub enum McpError {
    #[error("Invalid API key format")]
    InvalidApiKey,

    #[error("Authentication failed: {0}")]
    AuthenticationFailed(String),

    #[error("Configuration error: {0}")]
    ConfigError(String),

    #[error("HTTP error: {0}")]
    HttpError(#[from] reqwest::Error),

    #[error("JSON serialization error: {0}")]
    JsonError(#[from] serde_json::Error),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Tool execution error: {0}")]
    ToolError(String),

    #[error("Invalid parameter: {0}")]
    InvalidParameter(String),

    #[error("Missing required parameter: {0}")]
    MissingParameter(String),

    #[error("Server error: {0}")]
    ServerError(String),

    #[error("Transport error: {0}")]
    TransportError(String),

    #[error("Timeout error: {0}")]
    TimeoutError(String),

    #[error("Rate limit exceeded")]
    RateLimitExceeded,

    #[error("Service unavailable: {0}")]
    ServiceUnavailable(String),

    #[error("Unknown error: {0}")]
    Unknown(String),
}

impl McpError {
    /// Convert to HTTP status code
    pub fn to_status_code(&self) -> u16 {
        match self {
            McpError::InvalidApiKey | McpError::AuthenticationFailed(_) => 401,
            McpError::InvalidParameter(_) | McpError::MissingParameter(_) => 400,
            McpError::RateLimitExceeded => 429,
            McpError::ServiceUnavailable(_) => 503,
            McpError::TimeoutError(_) => 408,
            McpError::ConfigError(_) | McpError::ToolError(_) => 500,
            _ => 500,
        }
    }

    /// Check if error is retryable
    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            McpError::TimeoutError(_) | McpError::ServiceUnavailable(_) | McpError::RateLimitExceeded
        )
    }
}