//! Error types for Harness MCP Core

use thiserror::Error;

/// Result type alias for Harness MCP operations
pub type Result<T> = std::result::Result<T, Error>;

/// Main error type for Harness MCP operations
#[derive(Error, Debug)]
pub enum Error {
    /// Configuration errors
    #[error("Configuration error: {0}")]
    Config(String),

    /// Authentication errors
    #[error("Authentication error: {0}")]
    Auth(String),

    /// HTTP client errors
    #[error("HTTP client error: {0}")]
    Http(String),

    /// Serialization errors
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    /// IO errors
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    /// Generic errors
    #[error("Internal error: {0}")]
    Internal(String),

    /// Tool execution errors
    #[error("Tool execution error: {0}")]
    ToolExecution(String),

    /// License validation errors
    #[error("License validation error: {0}")]
    License(String),

    /// Invalid input errors
    #[error("Invalid input: {0}")]
    InvalidInput(String),
}

impl Error {
    /// Create a new configuration error
    pub fn config(msg: impl Into<String>) -> Self {
        Self::Config(msg.into())
    }

    /// Create a new authentication error
    pub fn auth(msg: impl Into<String>) -> Self {
        Self::Auth(msg.into())
    }

    /// Create a new internal error
    pub fn internal(msg: impl Into<String>) -> Self {
        Self::Internal(msg.into())
    }

    /// Create a new tool execution error
    pub fn tool_execution(msg: impl Into<String>) -> Self {
        Self::ToolExecution(msg.into())
    }

    /// Create a new license validation error
    pub fn license(msg: impl Into<String>) -> Self {
        Self::License(msg.into())
    }

    /// Create a new invalid input error
    pub fn invalid_input(msg: impl Into<String>) -> Self {
        Self::InvalidInput(msg.into())
    }
}
