//! Error handling for the Harness MCP Server
//! 
//! This module provides a unified error type that can represent various
//! error conditions that may occur during server operation.

use thiserror::Error;

/// Result type alias for convenience
pub type Result<T> = std::result::Result<T, Error>;

/// Main error type for the Harness MCP Server
#[derive(Error, Debug)]
pub enum Error {
    /// Configuration errors
    #[error("Configuration error: {0}")]
    Config(#[from] config::ConfigError),

    /// HTTP client errors
    #[error("HTTP client error: {0}")]
    Http(#[from] reqwest::Error),

    /// JSON serialization/deserialization errors
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    /// YAML serialization/deserialization errors
    #[error("YAML error: {0}")]
    Yaml(#[from] serde_yaml::Error),

    /// JWT token errors
    #[error("JWT error: {0}")]
    Jwt(#[from] jsonwebtoken::errors::Error),

    /// IO errors
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    /// Authentication errors
    #[error("Authentication error: {message}")]
    Auth { message: String },

    /// API errors from Harness services
    #[error("API error: {status} - {message}")]
    Api { status: u16, message: String },

    /// Validation errors
    #[error("Validation error: {0}")]
    Validation(String),

    /// Tool execution errors
    #[error("Tool execution error: {tool} - {message}")]
    ToolExecution { tool: String, message: String },

    /// Generic errors
    #[error("Internal error: {0}")]
    Internal(#[from] anyhow::Error),
}

impl Error {
    /// Create a new authentication error
    pub fn auth<S: Into<String>>(message: S) -> Self {
        Self::Auth {
            message: message.into(),
        }
    }

    /// Create a new API error
    pub fn api<S: Into<String>>(status: u16, message: S) -> Self {
        Self::Api {
            status,
            message: message.into(),
        }
    }

    /// Create a new validation error
    pub fn validation<S: Into<String>>(message: S) -> Self {
        Self::Validation(message.into())
    }

    /// Create a new tool execution error
    pub fn tool_execution<S1: Into<String>, S2: Into<String>>(tool: S1, message: S2) -> Self {
        Self::ToolExecution {
            tool: tool.into(),
            message: message.into(),
        }
    }
}