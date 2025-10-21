use thiserror::Error;

#[derive(Error, Debug)]
pub enum HarnessError {
    #[error("Configuration error: {0}")]
    Config(#[from] anyhow::Error),
    
    #[error("Authentication error: {0}")]
    Auth(String),
    
    #[error("API error: {0}")]
    Api(String),
    
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),
    
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Invalid parameter: {0}")]
    InvalidParameter(String),
    
    #[error("Missing required parameter: {0}")]
    MissingParameter(String),
    
    #[error("Tool execution error: {0}")]
    ToolExecution(String),
    
    #[error("License validation error: {0}")]
    License(String),
    
    #[error("Internal server error: {0}")]
    Internal(String),
}

pub type Result<T> = std::result::Result<T, HarnessError>;

impl HarnessError {
    pub fn http_status_code(&self) -> u16 {
        match self {
            HarnessError::Auth(_) => 401,
            HarnessError::InvalidParameter(_) | HarnessError::MissingParameter(_) => 400,
            HarnessError::Api(msg) if msg.contains("not found") => 404,
            HarnessError::Api(msg) if msg.contains("forbidden") => 403,
            HarnessError::License(_) => 403,
            _ => 500,
        }
    }
    
    pub fn is_client_error(&self) -> bool {
        matches!(self.http_status_code(), 400..=499)
    }
    
    pub fn is_server_error(&self) -> bool {
        matches!(self.http_status_code(), 500..=599)
    }
}