//! Error types for Harness MCP Server

use thiserror::Error;

/// Result type for server operations
pub type Result<T> = std::result::Result<T, ServerError>;

/// Server error types
#[derive(Error, Debug)]
pub enum ServerError {
    #[error("Configuration error: {0}")]
    Config(#[from] figment::Error),
    
    #[error("MCP protocol error: {0}")]
    Mcp(#[from] harness_mcp_proto::McpError),
    
    #[error("Harness API error: {0}")]
    HarnessApi(#[from] harness_mcp_client::HarnessError),
    
    #[error("HTTP error: {0}")]
    Http(#[from] hyper::Error),
    
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    
    #[error("Authentication error: {0}")]
    Auth(String),
    
    #[error("Authorization error: {0}")]
    Authorization(String),
    
    #[error("Tool error: {0}")]
    Tool(String),
    
    #[error("Module error: {0}")]
    Module(String),
    
    #[error("Internal error: {0}")]
    Internal(String),
    
    #[error("Invalid request: {0}")]
    InvalidRequest(String),
    
    #[error("Service unavailable: {0}")]
    ServiceUnavailable(String),
    
    #[error("Timeout: {0}")]
    Timeout(String),
    
    #[error("Rate limit exceeded: {0}")]
    RateLimit(String),
    
    #[error("Generic error: {0}")]
    Generic(#[from] anyhow::Error),
}