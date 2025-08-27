use thiserror::Error;

#[derive(Error, Debug)]
pub enum HarnessError {
    #[error("HTTP request failed: {0}")]
    HttpError(#[from] reqwest::Error),

    #[error("JSON serialization/deserialization error: {0}")]
    JsonError(#[from] serde_json::Error),

    #[error("Authentication error: {0}")]
    AuthError(String),

    #[error("Configuration error: {0}")]
    ConfigError(String),

    #[error("API error: {status} - {message}")]
    ApiError { status: u16, message: String },

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Tool execution error: {0}")]
    ToolError(String),

    #[error("MCP protocol error: {0}")]
    McpError(String),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("JWT error: {0}")]
    JwtError(#[from] jsonwebtoken::errors::Error),

    #[error("Generic error: {0}")]
    Other(#[from] anyhow::Error),
}

pub type Result<T> = std::result::Result<T, HarnessError>;

impl HarnessError {
    pub fn auth_error(msg: impl Into<String>) -> Self {
        Self::AuthError(msg.into())
    }

    pub fn config_error(msg: impl Into<String>) -> Self {
        Self::ConfigError(msg.into())
    }

    pub fn validation_error(msg: impl Into<String>) -> Self {
        Self::ValidationError(msg.into())
    }

    pub fn tool_error(msg: impl Into<String>) -> Self {
        Self::ToolError(msg.into())
    }

    pub fn mcp_error(msg: impl Into<String>) -> Self {
        Self::McpError(msg.into())
    }

    pub fn api_error(status: u16, message: impl Into<String>) -> Self {
        Self::ApiError {
            status,
            message: message.into(),
        }
    }
}