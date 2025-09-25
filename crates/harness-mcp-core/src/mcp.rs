//! MCP protocol implementation

use crate::types::*;
use crate::error::{Error, Result};
use crate::server::McpServer;
use async_trait::async_trait;
use std::sync::Arc;

/// MCP protocol handler
pub struct McpProtocol {
    server: Arc<dyn McpServer>,
    server_info: ServerInfo,
    protocol_version: String,
}

impl McpProtocol {
    pub fn new(server: Arc<dyn McpServer>, server_info: ServerInfo) -> Self {
        Self {
            server,
            server_info,
            protocol_version: "2024-11-05".to_string(),
        }
    }

    /// Handle a JSON-RPC request and return a response
    pub async fn handle_request(&self, request: JsonRpcRequest) -> Result<JsonRpcResponse> {
        let id = request.id.clone();
        
        match self.parse_mcp_request(&request) {
            Ok(mcp_request) => {
                match self.handle_mcp_request(mcp_request).await {
                    Ok(response) => {
                        let result = serde_json::to_value(response)
                            .map_err(|e| Error::Serialization(e))?;
                        Ok(JsonRpcResponse {
                            jsonrpc: "2.0".to_string(),
                            id,
                            result: Some(result),
                            error: None,
                        })
                    }
                    Err(e) => Ok(JsonRpcResponse {
                        jsonrpc: "2.0".to_string(),
                        id,
                        result: None,
                        error: Some(JsonRpcError {
                            code: -32603,
                            message: e.to_string(),
                            data: None,
                        }),
                    })
                }
            }
            Err(e) => Ok(JsonRpcResponse {
                jsonrpc: "2.0".to_string(),
                id,
                result: None,
                error: Some(JsonRpcError {
                    code: -32600,
                    message: e.to_string(),
                    data: None,
                }),
            })
        }
    }

    /// Parse a JSON-RPC request into an MCP request
    fn parse_mcp_request(&self, request: &JsonRpcRequest) -> Result<McpRequest> {
        let method = &request.method;
        let params = request.params.as_ref().unwrap_or(&serde_json::Value::Null);

        match method.as_str() {
            "initialize" => {
                let init_request: InitializeRequest = serde_json::from_value(params.clone())
                    .map_err(|e| Error::InvalidRequest(format!("Invalid initialize request: {}", e)))?;
                Ok(McpRequest::Initialize(init_request))
            }
            "tools/list" => {
                let list_request = if params.is_null() {
                    None
                } else {
                    Some(serde_json::from_value(params.clone())
                        .map_err(|e| Error::InvalidRequest(format!("Invalid tools/list request: {}", e)))?)
                };
                Ok(McpRequest::ListTools(list_request))
            }
            "tools/call" => {
                let call_request: CallToolRequest = serde_json::from_value(params.clone())
                    .map_err(|e| Error::InvalidRequest(format!("Invalid tools/call request: {}", e)))?;
                Ok(McpRequest::CallTool(call_request))
            }
            "resources/list" => {
                let list_request = if params.is_null() {
                    None
                } else {
                    Some(serde_json::from_value(params.clone())
                        .map_err(|e| Error::InvalidRequest(format!("Invalid resources/list request: {}", e)))?)
                };
                Ok(McpRequest::ListResources(list_request))
            }
            "resources/read" => {
                let read_request: ReadResourceRequest = serde_json::from_value(params.clone())
                    .map_err(|e| Error::InvalidRequest(format!("Invalid resources/read request: {}", e)))?;
                Ok(McpRequest::ReadResource(read_request))
            }
            "prompts/list" => {
                let list_request = if params.is_null() {
                    None
                } else {
                    Some(serde_json::from_value(params.clone())
                        .map_err(|e| Error::InvalidRequest(format!("Invalid prompts/list request: {}", e)))?)
                };
                Ok(McpRequest::ListPrompts(list_request))
            }
            "prompts/get" => {
                let get_request: GetPromptRequest = serde_json::from_value(params.clone())
                    .map_err(|e| Error::InvalidRequest(format!("Invalid prompts/get request: {}", e)))?;
                Ok(McpRequest::GetPrompt(get_request))
            }
            "ping" => Ok(McpRequest::Ping),
            _ => Err(Error::InvalidRequest(format!("Unknown method: {}", method))),
        }
    }

    /// Handle an MCP request and return an MCP response
    async fn handle_mcp_request(&self, request: McpRequest) -> Result<McpResponse> {
        match request {
            McpRequest::Initialize(init_request) => {
                self.handle_initialize(init_request).await
            }
            McpRequest::ListTools(list_request) => {
                self.handle_list_tools(list_request).await
            }
            McpRequest::CallTool(call_request) => {
                self.handle_call_tool(call_request).await
            }
            McpRequest::ListResources(list_request) => {
                self.handle_list_resources(list_request).await
            }
            McpRequest::ReadResource(read_request) => {
                self.handle_read_resource(read_request).await
            }
            McpRequest::ListPrompts(list_request) => {
                self.handle_list_prompts(list_request).await
            }
            McpRequest::GetPrompt(get_request) => {
                self.handle_get_prompt(get_request).await
            }
            McpRequest::Ping => Ok(McpResponse::Pong),
        }
    }

    async fn handle_initialize(&self, _request: InitializeRequest) -> Result<McpResponse> {
        let capabilities = self.server.get_capabilities().await?;
        Ok(McpResponse::Initialize(InitializeResponse {
            protocol_version: self.protocol_version.clone(),
            capabilities,
            server_info: self.server_info.clone(),
        }))
    }

    async fn handle_list_tools(&self, _request: Option<ListToolsRequest>) -> Result<McpResponse> {
        let tools = self.server.list_tools().await?;
        Ok(McpResponse::ListTools(ListToolsResponse {
            tools,
            next_cursor: None,
        }))
    }

    async fn handle_call_tool(&self, request: CallToolRequest) -> Result<McpResponse> {
        let tool_request = ToolCallRequest {
            name: request.name,
            arguments: request.arguments,
        };
        let result = self.server.call_tool(tool_request).await?;
        Ok(McpResponse::CallTool(CallToolResponse {
            content: result.content,
            is_error: result.is_error,
        }))
    }

    async fn handle_list_resources(&self, _request: Option<ListResourcesRequest>) -> Result<McpResponse> {
        // For now, return empty resources list
        Ok(McpResponse::ListResources(ListResourcesResponse {
            resources: vec![],
            next_cursor: None,
        }))
    }

    async fn handle_read_resource(&self, _request: ReadResourceRequest) -> Result<McpResponse> {
        // For now, return empty resource contents
        Ok(McpResponse::ReadResource(ReadResourceResponse {
            contents: vec![],
        }))
    }

    async fn handle_list_prompts(&self, _request: Option<ListPromptsRequest>) -> Result<McpResponse> {
        // For now, return empty prompts list
        Ok(McpResponse::ListPrompts(ListPromptsResponse {
            prompts: vec![],
            next_cursor: None,
        }))
    }

    async fn handle_get_prompt(&self, _request: GetPromptRequest) -> Result<McpResponse> {
        // For now, return empty prompt
        Ok(McpResponse::GetPrompt(GetPromptResponse {
            description: None,
            messages: vec![],
        }))
    }
}