use crate::mcp::types::*;
use serde_json::Value;

pub const PROTOCOL_VERSION: &str = "2024-11-05";

// MCP method names
pub const METHOD_INITIALIZE: &str = "initialize";
pub const METHOD_INITIALIZED: &str = "notifications/initialized";
pub const METHOD_TOOLS_LIST: &str = "tools/list";
pub const METHOD_TOOLS_CALL: &str = "tools/call";
pub const METHOD_RESOURCES_LIST: &str = "resources/list";
pub const METHOD_RESOURCES_READ: &str = "resources/read";
pub const METHOD_PROMPTS_LIST: &str = "prompts/list";
pub const METHOD_PROMPTS_GET: &str = "prompts/get";
pub const METHOD_LOGGING_SET_LEVEL: &str = "logging/setLevel";

// JSON-RPC error codes
pub const JSONRPC_PARSE_ERROR: i32 = -32700;
pub const JSONRPC_INVALID_REQUEST: i32 = -32600;
pub const JSONRPC_METHOD_NOT_FOUND: i32 = -32601;
pub const JSONRPC_INVALID_PARAMS: i32 = -32602;
pub const JSONRPC_INTERNAL_ERROR: i32 = -32603;

// MCP-specific error codes
pub const MCP_INVALID_TOOL: i32 = -32000;
pub const MCP_TOOL_EXECUTION_ERROR: i32 = -32001;
pub const MCP_RESOURCE_NOT_FOUND: i32 = -32002;
pub const MCP_PROMPT_NOT_FOUND: i32 = -32003;

pub fn create_error_response(id: Option<Value>, code: i32, message: &str, data: Option<Value>) -> JsonRpcResponse {
    JsonRpcResponse {
        jsonrpc: "2.0".to_string(),
        id,
        result: None,
        error: Some(JsonRpcError {
            code,
            message: message.to_string(),
            data,
        }),
    }
}

pub fn create_success_response(id: Option<Value>, result: Value) -> JsonRpcResponse {
    JsonRpcResponse {
        jsonrpc: "2.0".to_string(),
        id,
        result: Some(result),
        error: None,
    }
}

pub fn create_notification(method: &str, params: Option<Value>) -> JsonRpcRequest {
    JsonRpcRequest {
        jsonrpc: "2.0".to_string(),
        id: None,
        method: method.to_string(),
        params,
    }
}

pub fn create_default_server_capabilities() -> ServerCapabilities {
    ServerCapabilities {
        tools: Some(ToolsCapability {
            list_changed: Some(false),
        }),
        resources: Some(ResourcesCapability {
            subscribe: Some(false),
            list_changed: Some(false),
        }),
        prompts: Some(PromptsCapability {
            list_changed: Some(false),
        }),
        logging: Some(LoggingCapability {
            level: Some("info".to_string()),
        }),
    }
}