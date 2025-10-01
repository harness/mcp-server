use super::*;
use crate::error::{HarnessError, Result};
use serde_json::Value;
use std::collections::HashMap;

pub const MCP_PROTOCOL_VERSION: &str = "2024-11-05";

#[derive(Clone)]
pub struct McpProtocol {
    server_info: ServerInfo,
    capabilities: ServerCapabilities,
}

impl McpProtocol {
    pub fn new() -> Self {
        Self {
            server_info: ServerInfo {
                name: "harness-mcp-server".to_string(),
                version: env!("CARGO_PKG_VERSION").to_string(),
            },
            capabilities: ServerCapabilities {
                experimental: HashMap::new(),
                logging: None,
                prompts: None,
                resources: None,
                tools: Some(ToolsCapability {
                    list_changed: Some(false),
                }),
            },
        }
    }
    
    pub fn handle_request(&self, request: JsonRpcRequest) -> Result<JsonRpcResponse> {
        match request.method.as_str() {
            "initialize" => self.handle_initialize(request),
            "tools/list" => self.handle_list_tools(request),
            "tools/call" => self.handle_call_tool(request),
            _ => {
                let error = JsonRpcError::new(
                    -32601,
                    format!("Method not found: {}", request.method),
                );
                Ok(JsonRpcResponse::error(request.id, error))
            }
        }
    }
    
    fn handle_initialize(&self, request: JsonRpcRequest) -> Result<JsonRpcResponse> {
        let _params: InitializeRequest = if let Some(params) = request.params {
            serde_json::from_value(params)?
        } else {
            return Err(HarnessError::McpProtocol(
                "Initialize request missing parameters".to_string(),
            ));
        };
        
        let response = InitializeResponse {
            protocol_version: MCP_PROTOCOL_VERSION.to_string(),
            capabilities: self.capabilities.clone(),
            server_info: self.server_info.clone(),
        };
        
        let result = serde_json::to_value(response)?;
        Ok(JsonRpcResponse::success(request.id, result))
    }
    
    fn handle_list_tools(&self, request: JsonRpcRequest) -> Result<JsonRpcResponse> {
        // This will be implemented by the server with actual tools
        let response = ListToolsResponse {
            tools: vec![],
            next_cursor: None,
        };
        
        let result = serde_json::to_value(response)?;
        Ok(JsonRpcResponse::success(request.id, result))
    }
    
    fn handle_call_tool(&self, request: JsonRpcRequest) -> Result<JsonRpcResponse> {
        // This will be implemented by the server with actual tool execution
        let error = JsonRpcError::new(
            -32603,
            "Tool execution not implemented in protocol layer".to_string(),
        );
        Ok(JsonRpcResponse::error(request.id, error))
    }
}

impl Default for McpProtocol {
    fn default() -> Self {
        Self::new()
    }
}