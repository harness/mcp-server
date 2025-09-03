use serde::{Deserialize, Serialize};

pub mod dto;
pub mod traits;

/// Transport type for the MCP server
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TransportType {
    /// Standard input/output transport
    Stdio,
    /// HTTP transport
    Http,
}

impl Default for TransportType {
    fn default() -> Self {
        Self::Stdio
    }
}

impl std::fmt::Display for TransportType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TransportType::Stdio => write!(f, "stdio"),
            TransportType::Http => write!(f, "http"),
        }
    }
}

impl std::str::FromStr for TransportType {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "stdio" => Ok(TransportType::Stdio),
            "http" => Ok(TransportType::Http),
            _ => Err(format!("Invalid transport type: {}", s)),
        }
    }
}

/// License status for modules
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum LicenseStatus {
    Active,
    Inactive,
    Expired,
}

/// License information for an account
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicenseInfo {
    pub account_id: String,
    pub module_licenses: std::collections::HashMap<String, bool>,
    pub is_valid: bool,
}

/// Pagination options for API requests
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginationOptions {
    pub page: Option<u32>,
    pub size: Option<u32>,
}

impl Default for PaginationOptions {
    fn default() -> Self {
        Self {
            page: Some(0),
            size: Some(50),
        }
    }
}

/// Scope information for Harness resources
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Scope {
    pub account_id: String,
    pub org_id: Option<String>,
    pub project_id: Option<String>,
}

impl Scope {
    pub fn new(account_id: String) -> Self {
        Self {
            account_id,
            org_id: None,
            project_id: None,
        }
    }

    pub fn with_org(mut self, org_id: String) -> Self {
        self.org_id = Some(org_id);
        self
    }

    pub fn with_project(mut self, project_id: String) -> Self {
        self.project_id = Some(project_id);
        self
    }
}

/// Error types for the application
#[derive(thiserror::Error, Debug)]
pub enum HarnessError {
    #[error("Configuration error: {0}")]
    Config(String),
    
    #[error("Authentication error: {0}")]
    Auth(String),
    
    #[error("API error: {0}")]
    Api(String),
    
    #[error("Validation error: {0}")]
    Validation(String),
    
    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),
    
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}