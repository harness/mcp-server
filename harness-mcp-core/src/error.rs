use thiserror::Error;

pub type Result<T> = std::result::Result<T, McpError>;

#[derive(Error, Debug)]
pub enum McpError {
    #[error("Configuration error: {0}")]
    Config(String),
    
    #[error("Authentication failed: {0}")]
    Auth(String),
    
    #[error("API request failed: {status} - {message}")]
    Api { status: u16, message: String },
    
    #[error("Tool execution failed: {0}")]
    Tool(String),
    
    #[error("Missing required parameter: {0}")]
    MissingParameter(String),
    
    #[error("Invalid parameter value: {parameter} - {reason}")]
    InvalidParameter { parameter: String, reason: String },
    
    #[error("Scope validation failed: {0}")]
    Scope(String),
    
    #[error("Serialization failed: {0}")]
    Serialization(#[from] serde_json::Error),
    
    #[error("HTTP client error: {0}")]
    Http(#[from] reqwest::Error),
    
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Internal error: {0}")]
    Internal(String),
}

impl McpError {
    pub fn config<S: Into<String>>(msg: S) -> Self {
        Self::Config(msg.into())
    }
    
    pub fn auth<S: Into<String>>(msg: S) -> Self {
        Self::Auth(msg.into())
    }
    
    pub fn api(status: u16, message: String) -> Self {
        Self::Api { status, message }
    }
    
    pub fn tool<S: Into<String>>(msg: S) -> Self {
        Self::Tool(msg.into())
    }
    
    pub fn missing_parameter<S: Into<String>>(param: S) -> Self {
        Self::MissingParameter(param.into())
    }
    
    pub fn invalid_parameter<S: Into<String>>(param: S, reason: S) -> Self {
        Self::InvalidParameter {
            parameter: param.into(),
            reason: reason.into(),
        }
    }
    
    pub fn scope<S: Into<String>>(msg: S) -> Self {
        Self::Scope(msg.into())
    }
    
    pub fn internal<S: Into<String>>(msg: S) -> Self {
        Self::Internal(msg.into())
    }
}