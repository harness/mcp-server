pub mod manager;
pub mod toolset;
pub mod params;
pub mod pipelines;
pub mod connectors;
pub mod dashboards;
// Additional tool modules will be added here

pub use manager::ToolsetManager;
pub use toolset::{Tool, Toolset, ToolsetGroup, ToolResult};

use thiserror::Error;

/// Tool execution errors
#[derive(Error, Debug)]
pub enum ToolError {
    #[error("Tool not found: {name}")]
    NotFound { name: String },
    
    #[error("Invalid arguments: {message}")]
    InvalidArguments { message: String },
    
    #[error("Tool execution failed: {message}")]
    ExecutionFailed { message: String },
    
    #[error("Permission denied for tool: {name}")]
    PermissionDenied { name: String },
    
    #[error("HTTP request failed: {0}")]
    HttpError(#[from] reqwest::Error),
    
    #[error("JSON parsing error: {0}")]
    JsonError(#[from] serde_json::Error),
}