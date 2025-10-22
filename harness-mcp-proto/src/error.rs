//! Error types for MCP protocol

use thiserror::Error;

/// Result type for MCP operations
pub type Result<T> = std::result::Result<T, McpError>;

/// MCP protocol errors
#[derive(Error, Debug)]
pub enum McpError {
    #[error("Invalid request: {0}")]
    InvalidRequest(String),
    
    #[error("Method not found: {0}")]
    MethodNotFound(String),
    
    #[error("Invalid parameters: {0}")]
    InvalidParams(String),
    
    #[error("Internal error: {0}")]
    InternalError(String),
    
    #[error("Parse error: {0}")]
    ParseError(String),
    
    #[error("Transport error: {0}")]
    TransportError(String),
    
    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),
    
    #[error("HTTP error: {0}")]
    HttpError(#[from] hyper::Error),
    
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}

impl McpError {
    /// Get the error code for JSON-RPC response
    pub fn code(&self) -> i32 {
        match self {
            McpError::ParseError(_) => -32700,
            McpError::InvalidRequest(_) => -32600,
            McpError::MethodNotFound(_) => -32601,
            McpError::InvalidParams(_) => -32602,
            McpError::InternalError(_) => -32603,
            _ => -32000, // Server error
        }
    }
}