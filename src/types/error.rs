//! Error types for the Harness MCP server

use thiserror::Error;

/// Main error type for the Harness MCP server
#[derive(Error, Debug)]
pub enum HarnessError {
    #[error("Configuration error: {0}")]
    Config(String),
    
    #[error("Authentication error: {0}")]
    Auth(String),
    
    #[error("API error: {0}")]
    Api(String),
    
    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),
    
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Invalid API key format")]
    InvalidApiKey,
    
    #[error("License validation failed: {0}")]
    License(String),
    
    #[error("Module error: {0}")]
    Module(String),
    
    #[error("Toolset error: {0}")]
    Toolset(String),
    
    #[error("MCP protocol error: {0}")]
    Mcp(String),
    
    #[error("Internal error: {0}")]
    Internal(String),
}

/// Result type alias for convenience
pub type Result<T> = std::result::Result<T, HarnessError>;

impl HarnessError {
    /// Create a new configuration error
    pub fn config(msg: impl Into<String>) -> Self {
        Self::Config(msg.into())
    }
    
    /// Create a new authentication error
    pub fn auth(msg: impl Into<String>) -> Self {
        Self::Auth(msg.into())
    }
    
    /// Create a new API error
    pub fn api(msg: impl Into<String>) -> Self {
        Self::Api(msg.into())
    }
    
    /// Create a new license error
    pub fn license(msg: impl Into<String>) -> Self {
        Self::License(msg.into())
    }
    
    /// Create a new module error
    pub fn module(msg: impl Into<String>) -> Self {
        Self::Module(msg.into())
    }
    
    /// Create a new toolset error
    pub fn toolset(msg: impl Into<String>) -> Self {
        Self::Toolset(msg.into())
    }
    
    /// Create a new MCP protocol error
    pub fn mcp(msg: impl Into<String>) -> Self {
        Self::Mcp(msg.into())
    }
    
    /// Create a new internal error
    pub fn internal(msg: impl Into<String>) -> Self {
        Self::Internal(msg.into())
    }
}