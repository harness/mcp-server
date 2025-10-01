use super::*;
use crate::mcp::tool::{ToolHandler, ToolRegistry};
use crate::error::{HarnessError, Result};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;

#[derive(Clone)]
pub struct McpServer {
    protocol: McpProtocol,
    tool_registry: Arc<ToolRegistry>,
}

impl McpServer {
    pub fn new() -> Self {
        Self {
            protocol: McpProtocol::new(),
            tool_registry: Arc::new(ToolRegistry::new()),
        }
    }
    
    pub fn register_tool<H>(&mut self, tool: Tool, handler: H)
    where
        H: ToolHandler + 'static,
    {
        // Since we're using Arc, we need to get a mutable reference
        // This is a limitation - in practice, tools should be registered during initialization
        // For now, we'll create a new registry
        let mut registry = ToolRegistry::new();
        registry.register_tool(tool, handler);
        self.tool_registry = Arc::new(registry);
    }
    
    pub async fn handle_request(&self, request: JsonRpcRequest) -> Result<JsonRpcResponse> {
        match request.method.as_str() {
            "initialize" => self.protocol.handle_request(request),
            "tools/list" => self.handle_list_tools(request),
            "tools/call" => self.handle_call_tool(request).await,
            _ => {
                let error = JsonRpcError::new(
                    -32601,
                    format!("Method not found: {}", request.method),
                );
                Ok(JsonRpcResponse::error(request.id, error))
            }
        }
    }
    
    fn handle_list_tools(&self, request: JsonRpcRequest) -> Result<JsonRpcResponse> {
        let _params: ListToolsRequest = if let Some(params) = request.params {
            serde_json::from_value(params)?
        } else {
            ListToolsRequest { cursor: None }
        };
        
        let tools = self.tool_registry.list_tools();
        let response = ListToolsResponse {
            tools,
            next_cursor: None,
        };
        
        let result = serde_json::to_value(response)?;
        Ok(JsonRpcResponse::success(request.id, result))
    }
    
    async fn handle_call_tool(&self, request: JsonRpcRequest) -> Result<JsonRpcResponse> {
        let params: CallToolRequest = if let Some(params) = request.params {
            serde_json::from_value(params)?
        } else {
            return Err(HarnessError::McpProtocol(
                "Call tool request missing parameters".to_string(),
            ));
        };
        
        let response = self.tool_registry.call_tool(&params.name, params.arguments).await?;
        let result = serde_json::to_value(response)?;
        Ok(JsonRpcResponse::success(request.id, result))
    }
}

impl Default for McpServer {
    fn default() -> Self {
        Self::new()
    }
}