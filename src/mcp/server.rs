use crate::error::{Result, McpError};
use crate::mcp::protocol::*;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, error, info};

pub struct McpServer {
    tools: Arc<RwLock<HashMap<String, Box<dyn ToolHandler + Send + Sync>>>>,
    capabilities: ServerCapabilities,
    initialized: Arc<RwLock<bool>>,
}

#[async_trait::async_trait]
pub trait ToolHandler: Send + Sync {
    async fn call(&self, request: CallToolRequest) -> Result<CallToolResponse>;
    fn definition(&self) -> Tool;
}

impl McpServer {
    pub fn new() -> Self {
        Self {
            tools: Arc::new(RwLock::new(HashMap::new())),
            capabilities: ServerCapabilities {
                experimental: None,
                logging: Some(LoggingCapabilities {}),
                prompts: None,
                resources: None,
                tools: Some(ToolsCapabilities {
                    list_changed: Some(false),
                }),
            },
            initialized: Arc::new(RwLock::new(false)),
        }
    }

    pub async fn register_tool(&self, name: String, handler: Box<dyn ToolHandler + Send + Sync>) {
        let mut tools = self.tools.write().await;
        tools.insert(name, handler);
    }

    pub async fn handle_request(&self, request: JsonRpcRequest) -> Result<JsonRpcResponse> {
        debug!("Handling MCP request: {}", request.method);

        match request.method.as_str() {
            "initialize" => self.handle_initialize(request).await,
            "initialized" => self.handle_initialized(request).await,
            "tools/list" => self.handle_list_tools(request).await,
            "tools/call" => self.handle_call_tool(request).await,
            _ => Ok(JsonRpcResponse::error(
                request.id,
                JsonRpcError::method_not_found(),
            )),
        }
    }

    async fn handle_initialize(&self, request: JsonRpcRequest) -> Result<JsonRpcResponse> {
        let params: InitializeRequest = match request.params {
            Some(params) => serde_json::from_value(params)?,
            None => return Ok(JsonRpcResponse::error(
                request.id,
                JsonRpcError::invalid_params("Missing initialize parameters"),
            )),
        };

        info!("Initializing MCP server for client: {}", params.client_info.name);

        let response = InitializeResponse {
            protocol_version: MCP_VERSION.to_string(),
            capabilities: self.capabilities.clone(),
            server_info: ServerInfo {
                name: "harness-mcp-server".to_string(),
                version: env!("CARGO_PKG_VERSION").to_string(),
            },
        };

        Ok(JsonRpcResponse::success(request.id, serde_json::to_value(response)?))
    }

    async fn handle_initialized(&self, request: JsonRpcRequest) -> Result<JsonRpcResponse> {
        let mut initialized = self.initialized.write().await;
        *initialized = true;
        info!("MCP server initialized successfully");

        // Return empty success response for initialized notification
        Ok(JsonRpcResponse::success(request.id, serde_json::Value::Null))
    }

    async fn handle_list_tools(&self, request: JsonRpcRequest) -> Result<JsonRpcResponse> {
        let tools = self.tools.read().await;
        let tool_list: Vec<Tool> = tools.values()
            .map(|handler| handler.definition())
            .collect();

        let response = ListToolsResponse { tools: tool_list };
        Ok(JsonRpcResponse::success(request.id, serde_json::to_value(response)?))
    }

    async fn handle_call_tool(&self, request: JsonRpcRequest) -> Result<JsonRpcResponse> {
        let call_request: CallToolRequest = match request.params {
            Some(params) => serde_json::from_value(params)?,
            None => return Ok(JsonRpcResponse::error(
                request.id,
                JsonRpcError::invalid_params("Missing tool call parameters"),
            )),
        };

        let tools = self.tools.read().await;
        let handler = match tools.get(&call_request.name) {
            Some(handler) => handler,
            None => return Ok(JsonRpcResponse::error(
                request.id,
                JsonRpcError::invalid_params(&format!("Tool '{}' not found", call_request.name)),
            )),
        };

        match handler.call(call_request).await {
            Ok(tool_response) => Ok(JsonRpcResponse::success(
                request.id,
                serde_json::to_value(tool_response)?,
            )),
            Err(e) => {
                error!("Tool execution error: {}", e);
                Ok(JsonRpcResponse::error(
                    request.id,
                    JsonRpcError::internal_error(&e.to_string()),
                ))
            }
        }
    }

    pub async fn is_initialized(&self) -> bool {
        *self.initialized.read().await
    }
}

impl Default for McpServer {
    fn default() -> Self {
        Self::new()
    }
}