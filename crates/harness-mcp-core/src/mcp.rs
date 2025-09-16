use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

/// MCP protocol version
pub const MCP_VERSION: &str = "2024-11-05";

/// MCP message types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "method")]
pub enum McpMessage {
    #[serde(rename = "initialize")]
    Initialize(InitializeRequest),
    #[serde(rename = "tools/list")]
    ToolsList(ToolsListRequest),
    #[serde(rename = "tools/call")]
    ToolsCall(ToolsCallRequest),
    #[serde(rename = "resources/list")]
    ResourcesList(ResourcesListRequest),
    #[serde(rename = "prompts/list")]
    PromptsList(PromptsListRequest),
}

/// Initialize request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InitializeRequest {
    pub id: Uuid,
    pub params: InitializeParams,
}

/// Initialize parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InitializeParams {
    #[serde(rename = "protocolVersion")]
    pub protocol_version: String,
    #[serde(rename = "clientInfo")]
    pub client_info: ClientInfo,
    pub capabilities: ClientCapabilities,
}

/// Client information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientInfo {
    pub name: String,
    pub version: String,
}

/// Client capabilities
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientCapabilities {
    pub roots: Option<RootsCapability>,
    pub sampling: Option<SamplingCapability>,
}

/// Roots capability
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RootsCapability {
    #[serde(rename = "listChanged")]
    pub list_changed: Option<bool>,
}

/// Sampling capability
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SamplingCapability {}

/// Tools list request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolsListRequest {
    pub id: Uuid,
    pub params: Option<ToolsListParams>,
}

/// Tools list parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolsListParams {
    pub cursor: Option<String>,
}

/// Tools call request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolsCallRequest {
    pub id: Uuid,
    pub params: ToolsCallParams,
}

/// Tools call parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolsCallParams {
    pub name: String,
    pub arguments: Option<HashMap<String, serde_json::Value>>,
}

/// Resources list request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourcesListRequest {
    pub id: Uuid,
    pub params: Option<ResourcesListParams>,
}

/// Resources list parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourcesListParams {
    pub cursor: Option<String>,
}

/// Prompts list request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptsListRequest {
    pub id: Uuid,
    pub params: Option<PromptsListParams>,
}

/// Prompts list parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptsListParams {
    pub cursor: Option<String>,
}

/// MCP response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpResponse<T> {
    pub id: Uuid,
    pub result: Option<T>,
    pub error: Option<McpError>,
}

/// MCP error
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpError {
    pub code: i32,
    pub message: String,
    pub data: Option<serde_json::Value>,
}

/// Tool definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tool {
    pub name: String,
    pub description: String,
    #[serde(rename = "inputSchema")]
    pub input_schema: ToolInputSchema,
}

/// Tool input schema
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolInputSchema {
    #[serde(rename = "type")]
    pub schema_type: String,
    pub properties: HashMap<String, ToolProperty>,
    pub required: Option<Vec<String>>,
}

/// Tool property
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolProperty {
    #[serde(rename = "type")]
    pub property_type: String,
    pub description: Option<String>,
    #[serde(rename = "enum")]
    pub enum_values: Option<Vec<String>>,
}

/// Tool result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResult {
    pub content: Vec<ToolContent>,
    #[serde(rename = "isError")]
    pub is_error: Option<bool>,
}

/// Tool content
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ToolContent {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "image")]
    Image { data: String, mime_type: String },
    #[serde(rename = "resource")]
    Resource { resource: ResourceReference },
}

/// Resource reference
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceReference {
    pub uri: String,
    pub text: Option<String>,
}

/// Server capabilities
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerCapabilities {
    pub tools: Option<ToolsCapability>,
    pub resources: Option<ResourcesCapability>,
    pub prompts: Option<PromptsCapability>,
    pub logging: Option<LoggingCapability>,
}

/// Tools capability
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolsCapability {
    #[serde(rename = "listChanged")]
    pub list_changed: Option<bool>,
}

/// Resources capability
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourcesCapability {
    pub subscribe: Option<bool>,
    #[serde(rename = "listChanged")]
    pub list_changed: Option<bool>,
}

/// Prompts capability
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptsCapability {
    #[serde(rename = "listChanged")]
    pub list_changed: Option<bool>,
}

/// Logging capability
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoggingCapability {}

/// Initialize result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InitializeResult {
    #[serde(rename = "protocolVersion")]
    pub protocol_version: String,
    pub capabilities: ServerCapabilities,
    #[serde(rename = "serverInfo")]
    pub server_info: ServerInfo,
}

/// Server information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerInfo {
    pub name: String,
    pub version: String,
}

/// Tools list result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolsListResult {
    pub tools: Vec<Tool>,
    #[serde(rename = "nextCursor")]
    pub next_cursor: Option<String>,
}

impl McpError {
    /// Create a new parse error
    pub fn parse_error(message: String) -> Self {
        Self {
            code: -32700,
            message,
            data: None,
        }
    }

    /// Create a new invalid request error
    pub fn invalid_request(message: String) -> Self {
        Self {
            code: -32600,
            message,
            data: None,
        }
    }

    /// Create a new method not found error
    pub fn method_not_found(message: String) -> Self {
        Self {
            code: -32601,
            message,
            data: None,
        }
    }

    /// Create a new invalid params error
    pub fn invalid_params(message: String) -> Self {
        Self {
            code: -32602,
            message,
            data: None,
        }
    }

    /// Create a new internal error
    pub fn internal_error(message: String) -> Self {
        Self {
            code: -32603,
            message,
            data: None,
        }
    }
}

impl<T> McpResponse<T> {
    /// Create a successful response
    pub fn success(id: Uuid, result: T) -> Self {
        Self {
            id,
            result: Some(result),
            error: None,
        }
    }

    /// Create an error response
    pub fn error(id: Uuid, error: McpError) -> Self {
        Self {
            id,
            result: None,
            error: Some(error),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mcp_error_creation() {
        let error = McpError::invalid_request("test error".to_string());
        assert_eq!(error.code, -32600);
        assert_eq!(error.message, "test error");
    }

    #[test]
    fn test_mcp_response_success() {
        let id = Uuid::new_v4();
        let response = McpResponse::success(id, "test result");
        assert_eq!(response.id, id);
        assert_eq!(response.result, Some("test result"));
        assert!(response.error.is_none());
    }

    #[test]
    fn test_mcp_response_error() {
        let id = Uuid::new_v4();
        let error = McpError::internal_error("test error".to_string());
        let response: McpResponse<String> = McpResponse::error(id, error);
        assert_eq!(response.id, id);
        assert!(response.result.is_none());
        assert!(response.error.is_some());
    }
}