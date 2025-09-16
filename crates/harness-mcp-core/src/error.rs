use thiserror::Error;

/// Result type alias for MCP operations
pub type Result<T> = std::result::Result<T, McpError>;

/// Error types for MCP operations
#[derive(Error, Debug)]
pub enum McpError {
    #[error("Authentication error: {0}")]
    Authentication(String),

    #[error("Authorization error: {0}")]
    Authorization(String),

    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Internal server error: {0}")]
    Internal(String),

    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Tool error: {0}")]
    Tool(String),

    #[error("Transport error: {0}")]
    Transport(String),

    #[error("Timeout error: {0}")]
    Timeout(String),

    #[error("Rate limit exceeded: {0}")]
    RateLimit(String),

    #[error("Service unavailable: {0}")]
    ServiceUnavailable(String),

    #[error("Unknown error: {0}")]
    Unknown(String),
}

impl McpError {
    /// Create a new authentication error
    pub fn authentication<S: Into<String>>(msg: S) -> Self {
        Self::Authentication(msg.into())
    }

    /// Create a new authorization error
    pub fn authorization<S: Into<String>>(msg: S) -> Self {
        Self::Authorization(msg.into())
    }

    /// Create a new bad request error
    pub fn bad_request<S: Into<String>>(msg: S) -> Self {
        Self::BadRequest(msg.into())
    }

    /// Create a new not found error
    pub fn not_found<S: Into<String>>(msg: S) -> Self {
        Self::NotFound(msg.into())
    }

    /// Create a new internal error
    pub fn internal<S: Into<String>>(msg: S) -> Self {
        Self::Internal(msg.into())
    }

    /// Create a new config error
    pub fn config<S: Into<String>>(msg: S) -> Self {
        Self::Config(msg.into())
    }

    /// Create a new tool error
    pub fn tool<S: Into<String>>(msg: S) -> Self {
        Self::Tool(msg.into())
    }

    /// Create a new transport error
    pub fn transport<S: Into<String>>(msg: S) -> Self {
        Self::Transport(msg.into())
    }

    /// Create a new timeout error
    pub fn timeout<S: Into<String>>(msg: S) -> Self {
        Self::Timeout(msg.into())
    }

    /// Create a new rate limit error
    pub fn rate_limit<S: Into<String>>(msg: S) -> Self {
        Self::RateLimit(msg.into())
    }

    /// Create a new service unavailable error
    pub fn service_unavailable<S: Into<String>>(msg: S) -> Self {
        Self::ServiceUnavailable(msg.into())
    }

    /// Create a new unknown error
    pub fn unknown<S: Into<String>>(msg: S) -> Self {
        Self::Unknown(msg.into())
    }

    /// Get the HTTP status code for this error
    pub fn status_code(&self) -> u16 {
        match self {
            Self::Authentication(_) => 401,
            Self::Authorization(_) => 403,
            Self::BadRequest(_) => 400,
            Self::NotFound(_) => 404,
            Self::Internal(_) => 500,
            Self::Network(_) => 502,
            Self::Serialization(_) => 400,
            Self::Io(_) => 500,
            Self::Config(_) => 500,
            Self::Tool(_) => 500,
            Self::Transport(_) => 500,
            Self::Timeout(_) => 408,
            Self::RateLimit(_) => 429,
            Self::ServiceUnavailable(_) => 503,
            Self::Unknown(_) => 500,
        }
    }

    /// Check if this error is retryable
    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            Self::Network(_) | Self::Timeout(_) | Self::ServiceUnavailable(_)
        )
    }
}

/// Convert HTTP status codes to McpError
impl From<reqwest::StatusCode> for McpError {
    fn from(status: reqwest::StatusCode) -> Self {
        match status.as_u16() {
            400 => Self::BadRequest("Bad request".to_string()),
            401 => Self::Authentication("Unauthorized".to_string()),
            403 => Self::Authorization("Forbidden".to_string()),
            404 => Self::NotFound("Not found".to_string()),
            408 => Self::Timeout("Request timeout".to_string()),
            429 => Self::RateLimit("Rate limit exceeded".to_string()),
            500 => Self::Internal("Internal server error".to_string()),
            502 => Self::Network("Bad gateway".to_string()),
            503 => Self::ServiceUnavailable("Service unavailable".to_string()),
            _ => Self::Unknown(format!("HTTP error: {}", status)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_creation() {
        let err = McpError::authentication("test");
        assert_eq!(err.status_code(), 401);
        assert!(!err.is_retryable());
    }

    #[test]
    fn test_retryable_errors() {
        assert!(McpError::timeout("test").is_retryable());
        assert!(McpError::service_unavailable("test").is_retryable());
        assert!(!McpError::bad_request("test").is_retryable());
    }

    #[test]
    fn test_status_code_conversion() {
        let err = McpError::from(reqwest::StatusCode::NOT_FOUND);
        assert_eq!(err.status_code(), 404);
    }
}