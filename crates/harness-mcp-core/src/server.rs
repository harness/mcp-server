use crate::error::{McpError, Result};
use crate::mcp::*;
use crate::transport::{StdioTransport, HttpTransport, Transport};
use harness_mcp_config::Config;
use harness_mcp_tools::ToolsetGroup;
use std::io::{Read, Write};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, error, debug};
use uuid::Uuid;

/// MCP Server implementation
pub struct McpServer {
    config: Config,
    toolsets: Arc<RwLock<ToolsetGroup>>,
    server_info: ServerInfo,
}

impl McpServer {
    /// Create a new MCP server
    pub async fn new(config: Config) -> Result<Self> {
        let server_info = ServerInfo {
            name: "harness-mcp-server".to_string(),
            version: config.version.clone(),
        };

        // Initialize toolsets based on configuration
        let toolsets = ToolsetGroup::new(&config).await?;

        Ok(Self {
            config,
            toolsets: Arc::new(RwLock::new(toolsets)),
            server_info,
        })
    }

    /// Run the server with stdio transport
    pub async fn run_stdio<R, W>(&self, reader: R, writer: W) -> Result<()>
    where
        R: Read + Send + 'static,
        W: Write + Send + 'static,
    {
        let transport = StdioTransport::new(reader, writer);
        self.run_with_transport(transport).await
    }

    /// Run the server with HTTP transport
    pub async fn run_http(&self, port: u16, path: &str) -> Result<()> {
        let transport = HttpTransport::new(port, path.to_string());
        self.run_with_transport(transport).await
    }

    /// Run the server with a specific transport
    async fn run_with_transport<T: Transport>(&self, mut transport: T) -> Result<()> {
        info!("Starting MCP server with {} transport", T::name());

        loop {
            match transport.receive_message().await {
                Ok(message) => {
                    let response = self.handle_message(message).await;
                    if let Err(e) = transport.send_response(response).await {
                        error!("Failed to send response: {}", e);
                    }
                }
                Err(e) => {
                    error!("Failed to receive message: {}", e);
                    break;
                }
            }
        }

        Ok(())
    }

    /// Handle an incoming MCP message
    async fn handle_message(&self, message: McpMessage) -> serde_json::Value {
        match message {
            McpMessage::Initialize(req) => {
                self.handle_initialize(req).await
            }
            McpMessage::ToolsList(req) => {
                self.handle_tools_list(req).await
            }
            McpMessage::ToolsCall(req) => {
                self.handle_tools_call(req).await
            }
            McpMessage::ResourcesList(req) => {
                self.handle_resources_list(req).await
            }
            McpMessage::PromptsList(req) => {
                self.handle_prompts_list(req).await
            }
        }
    }

    /// Handle initialize request
    async fn handle_initialize(&self, req: InitializeRequest) -> serde_json::Value {
        debug!("Handling initialize request from client: {}", req.params.client_info.name);

        let capabilities = ServerCapabilities {
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
            logging: Some(LoggingCapability {}),
        };

        let result = InitializeResult {
            protocol_version: MCP_VERSION.to_string(),
            capabilities,
            server_info: self.server_info.clone(),
        };

        let response = McpResponse::success(req.id, result);
        serde_json::to_value(response).unwrap_or_else(|e| {
            error!("Failed to serialize initialize response: {}", e);
            serde_json::json!({
                "id": req.id,
                "error": {
                    "code": -32603,
                    "message": "Internal error"
                }
            })
        })
    }

    /// Handle tools list request
    async fn handle_tools_list(&self, req: ToolsListRequest) -> serde_json::Value {
        debug!("Handling tools list request");

        match self.get_tools_list().await {
            Ok(tools) => {
                let result = ToolsListResult {
                    tools,
                    next_cursor: None,
                };
                let response = McpResponse::success(req.id, result);
                serde_json::to_value(response).unwrap_or_else(|e| {
                    error!("Failed to serialize tools list response: {}", e);
                    self.create_error_response(req.id, McpError::internal_error(e.to_string()))
                })
            }
            Err(e) => {
                error!("Failed to get tools list: {}", e);
                self.create_error_response(req.id, McpError::internal_error(e.to_string()))
            }
        }
    }

    /// Handle tools call request
    async fn handle_tools_call(&self, req: ToolsCallRequest) -> serde_json::Value {
        debug!("Handling tools call request for tool: {}", req.params.name);

        match self.call_tool(&req.params.name, req.params.arguments).await {
            Ok(result) => {
                let response = McpResponse::success(req.id, result);
                serde_json::to_value(response).unwrap_or_else(|e| {
                    error!("Failed to serialize tool call response: {}", e);
                    self.create_error_response(req.id, McpError::internal_error(e.to_string()))
                })
            }
            Err(e) => {
                error!("Failed to call tool {}: {}", req.params.name, e);
                self.create_error_response(req.id, McpError::internal_error(e.to_string()))
            }
        }
    }

    /// Handle resources list request
    async fn handle_resources_list(&self, req: ResourcesListRequest) -> serde_json::Value {
        debug!("Handling resources list request");

        // For now, return empty resources list
        let result = serde_json::json!({
            "resources": []
        });
        let response = McpResponse::success(req.id, result);
        serde_json::to_value(response).unwrap_or_else(|e| {
            error!("Failed to serialize resources list response: {}", e);
            self.create_error_response(req.id, McpError::internal_error(e.to_string()))
        })
    }

    /// Handle prompts list request
    async fn handle_prompts_list(&self, req: PromptsListRequest) -> serde_json::Value {
        debug!("Handling prompts list request");

        // For now, return empty prompts list
        let result = serde_json::json!({
            "prompts": []
        });
        let response = McpResponse::success(req.id, result);
        serde_json::to_value(response).unwrap_or_else(|e| {
            error!("Failed to serialize prompts list response: {}", e);
            self.create_error_response(req.id, McpError::internal_error(e.to_string()))
        })
    }

    /// Get the list of available tools
    async fn get_tools_list(&self) -> Result<Vec<Tool>> {
        let toolsets = self.toolsets.read().await;
        Ok(toolsets.get_tools())
    }

    /// Call a specific tool
    async fn call_tool(
        &self,
        tool_name: &str,
        arguments: Option<std::collections::HashMap<String, serde_json::Value>>,
    ) -> Result<ToolResult> {
        let toolsets = self.toolsets.read().await;
        toolsets.call_tool(tool_name, arguments.unwrap_or_default()).await
    }

    /// Create an error response
    fn create_error_response(&self, id: Uuid, error: McpError) -> serde_json::Value {
        let response: McpResponse<serde_json::Value> = McpResponse::error(id, error);
        serde_json::to_value(response).unwrap_or_else(|_| {
            serde_json::json!({
                "id": id,
                "error": {
                    "code": -32603,
                    "message": "Internal error"
                }
            })
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use harness_mcp_config::Config;

    #[tokio::test]
    async fn test_server_creation() {
        let config = Config::default();
        let server = McpServer::new(config).await;
        assert!(server.is_ok());
    }

    #[tokio::test]
    async fn test_initialize_handling() {
        let config = Config::default();
        let server = McpServer::new(config).await.unwrap();

        let req = InitializeRequest {
            id: Uuid::new_v4(),
            params: InitializeParams {
                protocol_version: MCP_VERSION.to_string(),
                client_info: ClientInfo {
                    name: "test-client".to_string(),
                    version: "1.0.0".to_string(),
                },
                capabilities: ClientCapabilities {
                    roots: None,
                    sampling: None,
                },
            },
        };

        let response = server.handle_initialize(req).await;
        assert!(response.is_object());
    }
}