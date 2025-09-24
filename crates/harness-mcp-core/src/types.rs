//! Core type definitions

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
// use uuid::Uuid;
// use chrono::{DateTime, Utc};

/// Transport type for MCP server
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TransportType {
    /// Standard input/output transport
    Stdio,
    /// HTTP transport
    Http,
}

/// MCP tool definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tool {
    /// Tool name
    pub name: String,
    /// Tool description
    pub description: String,
    /// Input schema
    pub input_schema: serde_json::Value,
}

/// MCP tool result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResult {
    /// Result content
    pub content: Vec<ToolContent>,
    /// Whether the tool execution was successful
    pub is_error: bool,
}

/// Tool content types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ToolContent {
    /// Text content
    #[serde(rename = "text")]
    Text { text: String },
    /// Image content
    #[serde(rename = "image")]
    Image { data: String, mime_type: String },
    /// Resource content
    #[serde(rename = "resource")]
    Resource { resource: ResourceReference },
}

/// Resource reference
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceReference {
    /// Resource URI
    pub uri: String,
    /// Resource text content
    pub text: Option<String>,
}

/// MCP resource definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Resource {
    /// Resource URI
    pub uri: String,
    /// Resource name
    pub name: String,
    /// Resource description
    pub description: Option<String>,
    /// Resource MIME type
    pub mime_type: Option<String>,
}

/// MCP prompt definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Prompt {
    /// Prompt name
    pub name: String,
    /// Prompt description
    pub description: Option<String>,
    /// Prompt arguments
    pub arguments: Option<Vec<PromptArgument>>,
}

/// Prompt argument
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptArgument {
    /// Argument name
    pub name: String,
    /// Argument description
    pub description: Option<String>,
    /// Whether the argument is required
    pub required: Option<bool>,
}

/// Harness scope information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HarnessScope {
    /// Account ID
    pub account_id: String,
    /// Organization ID
    pub org_id: Option<String>,
    /// Project ID
    pub project_id: Option<String>,
}

/// Pagination parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pagination {
    /// Page number (0-based)
    pub page: Option<u32>,
    /// Page size
    pub size: Option<u32>,
    /// Sort field
    pub sort: Option<String>,
    /// Sort order
    pub order: Option<SortOrder>,
}

/// Sort order
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SortOrder {
    #[serde(rename = "ASC")]
    Ascending,
    #[serde(rename = "DESC")]
    Descending,
}

/// Generic API response wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    /// Response status
    pub status: String,
    /// Response data
    pub data: Option<T>,
    /// Response metadata
    pub metadata: Option<HashMap<String, serde_json::Value>>,
    /// Error details
    pub error: Option<ApiError>,
}

/// API error details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiError {
    /// Error code
    pub code: String,
    /// Error message
    pub message: String,
    /// Error details
    pub details: Option<HashMap<String, serde_json::Value>>,
}

/// License information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicenseInfo {
    /// Account ID
    pub account_id: String,
    /// Module licenses
    pub module_licenses: HashMap<String, bool>,
    /// Whether the license is valid
    pub is_valid: bool,
}

/// Module definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Module {
    /// Module ID
    pub id: String,
    /// Module name
    pub name: String,
    /// Module description
    pub description: Option<String>,
    /// Whether the module is enabled by default
    pub is_default: bool,
    /// Module toolsets
    pub toolsets: Vec<String>,
}

impl Default for Pagination {
    fn default() -> Self {
        Self {
            page: Some(0),
            size: Some(50),
            sort: None,
            order: Some(SortOrder::Ascending),
        }
    }
}
