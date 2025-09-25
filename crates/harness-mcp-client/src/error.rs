//! Error types for the HTTP client library

use thiserror::Error;

/// Result type alias for client operations
pub type Result<T> = std::result::Result<T, Error>;

/// Client error types
#[derive(Error, Debug)]
pub enum Error {
    /// HTTP request errors
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),

    /// Serialization/deserialization errors
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    /// Authentication errors
    #[error("Authentication error: {0}")]
    Authentication(String),

    /// API errors
    #[error("API error: {status} - {message}")]
    Api { status: u16, message: String },

    /// Configuration errors
    #[error("Configuration error: {0}")]
    Configuration(String),

    /// URL parsing errors
    #[error("URL parsing error: {0}")]
    UrlParse(#[from] url::ParseError),

    /// Generic errors
    #[error("Error: {0}")]
    Generic(String),
}