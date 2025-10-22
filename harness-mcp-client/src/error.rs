//! Error types for Harness client

use thiserror::Error;

/// Result type for client operations
pub type Result<T> = std::result::Result<T, HarnessError>;

/// Harness client error types
#[derive(Error, Debug)]
pub enum HarnessError {
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),
    
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    
    #[error("Authentication error: {0}")]
    Auth(String),
    
    #[error("API error: {status} - {message}")]
    Api { status: u16, message: String },
    
    #[error("Timeout: {0}")]
    Timeout(String),
    
    #[error("Rate limit exceeded")]
    RateLimit,
    
    #[error("Invalid configuration: {0}")]
    Config(String),
    
    #[error("Generic error: {0}")]
    Generic(#[from] anyhow::Error),
}