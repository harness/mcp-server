use thiserror::Error;

/// Core error types for the Harness MCP Server
#[derive(Error, Debug)]
pub enum Error {
    #[error("Configuration error: {0}")]
    Config(#[from] harness_config::ConfigError),
    
    #[error("Authentication error: {0}")]
    Auth(#[from] harness_auth::AuthError),
    
    #[error("HTTP client error: {0}")]
    Http(#[from] reqwest::Error),
    
    #[error("JSON serialization error: {0}")]
    Json(#[from] serde_json::Error),
    
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("MCP protocol error: {0}")]
    Mcp(String),
    
    #[error("Toolset error: {0}")]
    Toolset(String),
    
    #[error("Service unavailable: {service}")]
    ServiceUnavailable { service: String },
    
    #[error("Invalid request: {message}")]
    InvalidRequest { message: String },
    
    #[error("Permission denied: {message}")]
    PermissionDenied { message: String },
    
    #[error("Resource not found: {resource}")]
    NotFound { resource: String },
    
    #[error("Internal server error: {message}")]
    Internal { message: String },
}

/// Result type alias for convenience
pub type Result<T> = std::result::Result<T, Error>;

impl Error {
    /// Create a new MCP protocol error
    pub fn mcp<S: Into<String>>(message: S) -> Self {
        Self::Mcp(message.into())
    }
    
    /// Create a new toolset error
    pub fn toolset<S: Into<String>>(message: S) -> Self {
        Self::Toolset(message.into())
    }
    
    /// Create a new service unavailable error
    pub fn service_unavailable<S: Into<String>>(service: S) -> Self {
        Self::ServiceUnavailable {
            service: service.into(),
        }
    }
    
    /// Create a new invalid request error
    pub fn invalid_request<S: Into<String>>(message: S) -> Self {
        Self::InvalidRequest {
            message: message.into(),
        }
    }
    
    /// Create a new permission denied error
    pub fn permission_denied<S: Into<String>>(message: S) -> Self {
        Self::PermissionDenied {
            message: message.into(),
        }
    }
    
    /// Create a new not found error
    pub fn not_found<S: Into<String>>(resource: S) -> Self {
        Self::NotFound {
            resource: resource.into(),
        }
    }
    
    /// Create a new internal error
    pub fn internal<S: Into<String>>(message: S) -> Self {
        Self::Internal {
            message: message.into(),
        }
    }
}