//! Error types for authentication and authorization

use thiserror::Error;

/// Result type alias for auth operations
pub type Result<T> = std::result::Result<T, Error>;

/// Authentication error types
#[derive(Error, Debug)]
pub enum Error {
    /// JWT token errors
    #[error("JWT error: {0}")]
    Jwt(#[from] jsonwebtoken::errors::Error),

    /// Invalid API key format
    #[error("Invalid API key format: {0}")]
    InvalidApiKey(String),

    /// Authentication failed
    #[error("Authentication failed: {0}")]
    AuthenticationFailed(String),

    /// Authorization failed
    #[error("Authorization failed: {0}")]
    AuthorizationFailed(String),

    /// Token expired
    #[error("Token expired")]
    TokenExpired,

    /// Invalid session
    #[error("Invalid session: {0}")]
    InvalidSession(String),

    /// HTTP errors
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),

    /// Serialization errors
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    /// Base64 decoding errors
    #[error("Base64 decode error: {0}")]
    Base64Decode(#[from] base64::DecodeError),

    /// Generic errors
    #[error("Error: {0}")]
    Generic(String),
}