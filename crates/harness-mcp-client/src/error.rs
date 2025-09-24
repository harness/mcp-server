//! Client error types

use thiserror::Error;

/// Result type alias for client operations
pub type ClientResult<T> = std::result::Result<T, ClientError>;

/// Client error types
#[derive(Error, Debug)]
pub enum ClientError {
    /// HTTP request errors
    #[error("HTTP request error: {0}")]
    Http(#[from] reqwest::Error),

    /// Serialization errors
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    /// Authentication errors
    #[error("Authentication error: {0}")]
    Auth(String),

    /// API errors
    #[error("API error: {code} - {message}")]
    Api { code: String, message: String },

    /// Configuration errors
    #[error("Configuration error: {0}")]
    Config(String),

    /// Generic errors
    #[error("Client error: {0}")]
    Generic(String),
}

impl ClientError {
    /// Create a new authentication error
    pub fn auth(msg: impl Into<String>) -> Self {
        Self::Auth(msg.into())
    }

    /// Create a new API error
    pub fn api(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self::Api {
            code: code.into(),
            message: message.into(),
        }
    }

    /// Create a new configuration error
    pub fn config(msg: impl Into<String>) -> Self {
        Self::Config(msg.into())
    }

    /// Create a new generic error
    pub fn generic(msg: impl Into<String>) -> Self {
        Self::Generic(msg.into())
    }
}
