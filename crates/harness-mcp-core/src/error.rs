//! Error types for the MCP core library

use thiserror::Error;

/// Result type alias for MCP operations
pub type Result<T> = std::result::Result<T, Error>;

/// Core error types for MCP operations
#[derive(Error, Debug)]
pub enum Error {
    /// JSON-RPC protocol errors
    #[error("JSON-RPC error: {0}")]
    JsonRpc(String),

    /// Serialization/deserialization errors
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    /// IO errors
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    /// Transport errors
    #[error("Transport error: {0}")]
    Transport(String),

    /// Tool execution errors
    #[error("Tool execution error: {0}")]
    ToolExecution(String),

    /// Invalid request errors
    #[error("Invalid request: {0}")]
    InvalidRequest(String),

    /// Server errors
    #[error("Server error: {0}")]
    Server(String),

    /// Generic errors
    #[error("Error: {0}")]
    Generic(String),
}