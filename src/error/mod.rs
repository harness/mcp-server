use thiserror::Error;

#[derive(Error, Debug)]
pub enum McpError {
    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Authentication error: {0}")]
    Auth(String),

    #[error("HTTP client error: {0}")]
    Http(#[from] reqwest::Error),

    #[error("JSON serialization error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("YAML serialization error: {0}")]
    Yaml(#[from] serde_yaml::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JWT error: {0}")]
    Jwt(#[from] jsonwebtoken::errors::Error),

    #[error("UUID error: {0}")]
    Uuid(#[from] uuid::Error),

    #[error("URL parse error: {0}")]
    UrlParse(#[from] url::ParseError),

    #[error("MCP protocol error: {0}")]
    Protocol(String),

    #[error("Tool execution error: {0}")]
    ToolExecution(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Service unavailable: {service}")]
    ServiceUnavailable { service: String },

    #[error("Rate limit exceeded for service: {service}")]
    RateLimit { service: String },

    #[error("Timeout error: {0}")]
    Timeout(String),

    #[error("Internal server error: {0}")]
    Internal(String),
}

pub type Result<T> = std::result::Result<T, McpError>;

impl McpError {
    pub fn config(msg: impl Into<String>) -> Self {
        Self::Config(msg.into())
    }

    pub fn auth(msg: impl Into<String>) -> Self {
        Self::Auth(msg.into())
    }

    pub fn protocol(msg: impl Into<String>) -> Self {
        Self::Protocol(msg.into())
    }

    pub fn tool_execution(msg: impl Into<String>) -> Self {
        Self::ToolExecution(msg.into())
    }

    pub fn validation(msg: impl Into<String>) -> Self {
        Self::Validation(msg.into())
    }

    pub fn timeout(msg: impl Into<String>) -> Self {
        Self::Timeout(msg.into())
    }

    pub fn internal(msg: impl Into<String>) -> Self {
        Self::Internal(msg.into())
    }

    pub fn service_unavailable(service: impl Into<String>) -> Self {
        Self::ServiceUnavailable {
            service: service.into(),
        }
    }

    pub fn rate_limit(service: impl Into<String>) -> Self {
        Self::RateLimit {
            service: service.into(),
        }
    }
}

// Convert anyhow::Error to McpError
impl From<anyhow::Error> for McpError {
    fn from(err: anyhow::Error) -> Self {
        Self::Internal(err.to_string())
    }
}