use crate::config::Config;
use crate::error::{McpError, Result};
use crate::mcp::*;
use crate::tools::ToolRegistry;
use serde_json::Value;
use std::collections::HashMap;
use tracing::{debug, error, info, warn};

pub struct McpProtocolHandler {
    pub config: Config,
    pub tool_registry: ToolRegistry,
    initialized: bool,
}

impl McpProtocolHandler {
    pub fn new(config: Config, tool_registry: ToolRegistry) -> Self {
        Self {
            config,
            tool_registry,
            initialized: false,
        }
    }

    pub async fn handle_message(&mut self, message: JsonRpcMessage) -> Result<Option<JsonRpcMessage>> {
        match message {
            JsonRpcMessage::Request(request) => {
                let response = self.handle_request(request).await?;
                Ok(Some(JsonRpcMessage::Response(response)))
            }
            JsonRpcMessage::Notification(notification) => {
                self.handle_notification(notification).await?;
                Ok(None)
            }
            JsonRpcMessage::Response(_) => {
                warn!("Received unexpected response message");
                Ok(None)
            }
        }
    }

    async fn handle_request(&mut self, request: JsonRpcRequest) -> Result<JsonRpcResponse> {
        debug!("Handling request: {}", request.method);

        let result = match request.method.as_str() {
            "initialize" => self.handle_initialize(request.params).await,
            "tools/list" => self.handle_list_tools(request.params).await,
            "tools/call" => self.handle_call_tool(request.params).await,
            _ => {
                warn!("Unknown method: {}", request.method);
                return Ok(JsonRpcResponse::error(
                    request.id,
                    JsonRpcError::method_not_found(),
                ));
            }
        };

        match result {
            Ok(value) => Ok(JsonRpcResponse::success(request.id, value)),
            Err(e) => {
                error!("Request failed: {}", e);
                Ok(JsonRpcResponse::error(
                    request.id,
                    JsonRpcError::custom(-32000, e.to_string(), None),
                ))
            }
        }
    }

    async fn handle_notification(&mut self, notification: JsonRpcNotification) -> Result<()> {
        debug!("Handling notification: {}", notification.method);

        match notification.method.as_str() {
            "initialized" => {
                info!("Client initialized");
                self.initialized = true;
            }
            _ => {
                warn!("Unknown notification: {}", notification.method);
            }
        }

        Ok(())
    }

    async fn handle_initialize(&mut self, params: Option<Value>) -> Result<Value> {
        let request: InitializeRequest = if let Some(params) = params {
            serde_json::from_value(params).map_err(|_| McpError::InvalidParameter("initialize".to_string()))?
        } else {
            return Err(McpError::MissingParameter("initialize params".to_string()));
        };

        info!(
            "Initializing MCP server for client: {} v{}",
            request.client_info.name, request.client_info.version
        );

        let response = InitializeResponse {
            protocol_version: PROTOCOL_VERSION.to_string(),
            capabilities: ServerCapabilities {
                logging: Some(LoggingCapability {}),
                prompts: None,
                resources: None,
                tools: Some(ToolsCapability {
                    list_changed: Some(false),
                }),
            },
            server_info: ServerInfo {
                name: SERVER_NAME.to_string(),
                version: self.config.version.clone().unwrap_or_else(|| "0.1.0".to_string()),
            },
        };

        serde_json::to_value(response).map_err(McpError::JsonError)
    }

    async fn handle_list_tools(&self, _params: Option<Value>) -> Result<Value> {
        if !self.initialized {
            return Err(McpError::ServerError("Not initialized".to_string()));
        }

        let tools = self.tool_registry.get_tools();
        let response = ListToolsResponse {
            tools: tools.into_iter().cloned().collect(),
        };

        serde_json::to_value(response).map_err(McpError::JsonError)
    }

    async fn handle_call_tool(&self, params: Option<Value>) -> Result<Value> {
        if !self.initialized {
            return Err(McpError::ServerError("Not initialized".to_string()));
        }

        let request: CallToolRequest = if let Some(params) = params {
            serde_json::from_value(params).map_err(|_| McpError::InvalidParameter("call_tool".to_string()))?
        } else {
            return Err(McpError::MissingParameter("call_tool params".to_string()));
        };

        debug!("Calling tool: {}", request.name);

        // Convert to internal tool call format
        let tool_call = crate::tools::ToolCall {
            name: request.name,
            arguments: request.arguments.unwrap_or_default(),
        };

        let result = self.tool_registry.execute_tool(tool_call).await?;

        let response = CallToolResponse {
            content: result.content,
            is_error: Some(result.is_error),
        };

        serde_json::to_value(response).map_err(McpError::JsonError)
    }

    pub fn parse_message(data: &str) -> Result<JsonRpcMessage> {
        serde_json::from_str(data).map_err(|e| {
            error!("Failed to parse JSON-RPC message: {}", e);
            McpError::JsonError(e)
        })
    }

    pub fn serialize_message(message: &JsonRpcMessage) -> Result<String> {
        serde_json::to_string(message).map_err(McpError::JsonError)
    }
}