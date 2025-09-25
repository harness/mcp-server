//! Error types for configuration management

use thiserror::Error;

/// Result type alias for configuration operations
pub type Result<T> = std::result::Result<T, Error>;

/// Configuration error types
#[derive(Error, Debug)]
pub enum Error {
    /// Configuration parsing errors
    #[error("Configuration error: {0}")]
    Config(#[from] figment::Error),

    /// IO errors
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    /// URL parsing errors
    #[error("URL parsing error: {0}")]
    UrlParse(#[from] url::ParseError),

    /// Missing required configuration
    #[error("Missing required configuration: {0}")]
    MissingRequired(String),

    /// Invalid configuration value
    #[error("Invalid configuration value: {0}")]
    InvalidValue(String),
}