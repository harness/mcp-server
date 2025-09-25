use crate::config::Config;
use crate::error::{HarnessError, Result};
use crate::mcp::*;
use crate::tools::{ToolRegistry, Tool as ToolTrait};
use serde_json::json;
use std::collections::HashMap;
use tracing::{debug, error, info};

/// MCP Server implementation
pub struct McpServer {
    config: Config,
    tool_registry: ToolRegistry,
    initialized: bool,
}

impl McpServer {
    pub fn new(config: Config, tool_registry: ToolRegistry) -> Self {
        Self {
            config,
            tool_registry,
            initialized: false,
        }
    }
    
    /// Handle MCP JSON-RPC request
    pub async fn handle_request(&mut self, request: JsonRpcRequest) -> JsonRpcResponse {
        debug!("Handling MCP request: method={}", request.method);
        
        match request.method.as_str() {
            "initialize" => self.handle_initialize(request).await,
            "initialized" => self.handle_initialized(request).await,
            "tools/list" => self.handle_list_tools(request).await,
            "tools/call" => self.handle_call_tool(request).await,
            _ => JsonRpcResponse::error(
                request.id,
                -32601,
                format!("Method not found: {}", request.method),
            ),
        }
    }
    
    async fn handle_initialize(&mut self, request: JsonRpcRequest) -> JsonRpcResponse {
        debug!("Handling initialize request");
        
        let init_request: InitializeRequest = match request.params {
            Some(params) => match serde_json::from_value(params) {
                Ok(req) => req,
                Err(e) => {
                    error!("Failed to parse initialize request: {}", e);
                    return JsonRpcResponse::error(
                        request.id,
                        -32602,
                        "Invalid initialize request parameters".to_string(),
                    );
                }
            },
            None => {
                return JsonRpcResponse::error(
                    request.id,
                    -32602,
                    "Missing initialize request parameters".to_string(),
                );
            }
        };
        
        info!("Initializing MCP server for client: {} v{}", 
              init_request.client_info.name, init_request.client_info.version);
        
        let result = InitializeResult {
            protocol_version: "2024-11-05".to_string(),
            capabilities: ServerCapabilities {
                tools: Some(ToolCapabilities {
                    list_changed: Some(false),
                }),
                resources: Some(ResourceCapabilities {
                    subscribe: false,
                    list_changed: Some(false),
                }),
                prompts: Some(PromptCapabilities {
                    list_changed: Some(false),
                }),
                logging: Some(LoggingCapabilities {
                    level: Some("info".to_string()),
                }),
            },
            server_info: ServerInfo {
                name: "harness-mcp-server".to_string(),
                version: self.config.version.clone(),
            },
        };
        
        JsonRpcResponse::success(request.id, serde_json::to_value(result).unwrap())
    }
    
    async fn handle_initialized(&mut self, request: JsonRpcRequest) -> JsonRpcResponse {
        debug!("Handling initialized notification");
        self.initialized = true;
        info!("MCP server initialization complete");
        
        // Return empty result for notification
        JsonRpcResponse::success(request.id, json!({}))
    }
    
    async fn handle_list_tools(&self, request: JsonRpcRequest) -> JsonRpcResponse {
        debug!("Handling list tools request");
        
        if !self.initialized {
            return JsonRpcResponse::error(
                request.id,
                -32002,
                "Server not initialized".to_string(),
            );
        }
        
        let tools: Vec<Tool> = self.tool_registry.list_tools()
            .iter()
            .map(|tool_name| {
                let tool = self.tool_registry.get_tool(tool_name).unwrap();
                Tool {
                    name: tool.name().to_string(),
                    description: Some(tool.description().to_string()),
                    input_schema: ToolInputSchema {
                        schema_type: "object".to_string(),
                        properties: Some(self.get_tool_properties(tool_name)),
                        required: Some(self.get_required_properties(tool_name)),
                    },
                }
            })
            .collect();
        
        let result = ListToolsResult { tools };
        JsonRpcResponse::success(request.id, serde_json::to_value(result).unwrap())
    }
    
    async fn handle_call_tool(&self, request: JsonRpcRequest) -> JsonRpcResponse {
        debug!("Handling call tool request");
        
        if !self.initialized {
            return JsonRpcResponse::error(
                request.id,
                -32002,
                "Server not initialized".to_string(),
            );
        }
        
        let call_request: CallToolRequest = match request.params {
            Some(params) => match serde_json::from_value(params) {
                Ok(req) => req,
                Err(e) => {
                    error!("Failed to parse call tool request: {}", e);
                    return JsonRpcResponse::error(
                        request.id,
                        -32602,
                        "Invalid call tool request parameters".to_string(),
                    );
                }
            },
            None => {
                return JsonRpcResponse::error(
                    request.id,
                    -32602,
                    "Missing call tool request parameters".to_string(),
                );
            }
        };
        
        debug!("Calling tool: {}", call_request.name);
        
        let tool = match self.tool_registry.get_tool(&call_request.name) {
            Some(tool) => tool,
            None => {
                return JsonRpcResponse::error(
                    request.id,
                    -32601,
                    format!("Tool not found: {}", call_request.name),
                );
            }
        };
        
        // Convert arguments to JSON value
        let args = call_request.arguments
            .map(|args| serde_json::to_value(args).unwrap())
            .unwrap_or(json!({}));
        
        match tool.execute(args).await {
            Ok(result) => {
                let content = vec![Content::json(&result)];
                let tool_result = CallToolResult::success(content);
                JsonRpcResponse::success(request.id, serde_json::to_value(tool_result).unwrap())
            }
            Err(e) => {
                error!("Tool execution failed: {}", e);
                let tool_result = CallToolResult::error(e.to_string());
                JsonRpcResponse::success(request.id, serde_json::to_value(tool_result).unwrap())
            }
        }
    }
    
    fn get_tool_properties(&self, tool_name: &str) -> HashMap<String, PropertySchema> {
        let mut properties = HashMap::new();
        
        // Add common scope properties for all tools
        properties.insert("orgIdentifier".to_string(), PropertySchema {
            property_type: "string".to_string(),
            description: Some("Organization identifier".to_string()),
            default: self.config.default_org_id.as_ref().map(|s| json!(s)),
            minimum: None,
            maximum: None,
            items: None,
        });
        
        properties.insert("projectIdentifier".to_string(), PropertySchema {
            property_type: "string".to_string(),
            description: Some("Project identifier".to_string()),
            default: self.config.default_project_id.as_ref().map(|s| json!(s)),
            minimum: None,
            maximum: None,
            items: None,
        });
        
        // Add tool-specific properties based on tool name
        match tool_name {
            "list_pipelines" => {
                properties.insert("page".to_string(), PropertySchema {
                    property_type: "number".to_string(),
                    description: Some("Page number for pagination".to_string()),
                    default: Some(json!(0)),
                    minimum: Some(0.0),
                    maximum: None,
                    items: None,
                });
                
                properties.insert("size".to_string(), PropertySchema {
                    property_type: "number".to_string(),
                    description: Some("Page size for pagination".to_string()),
                    default: Some(json!(20)),
                    minimum: Some(1.0),
                    maximum: Some(100.0),
                    items: None,
                });
                
                properties.insert("searchTerm".to_string(), PropertySchema {
                    property_type: "string".to_string(),
                    description: Some("Optional search term to filter pipelines".to_string()),
                    default: None,
                    minimum: None,
                    maximum: None,
                    items: None,
                });
                
                properties.insert("filterIdentifier".to_string(), PropertySchema {
                    property_type: "string".to_string(),
                    description: Some("Optional filter identifier".to_string()),
                    default: None,
                    minimum: None,
                    maximum: None,
                    items: None,
                });
            }
            "get_pipeline" => {
                properties.insert("pipelineIdentifier".to_string(), PropertySchema {
                    property_type: "string".to_string(),
                    description: Some("Pipeline identifier".to_string()),
                    default: None,
                    minimum: None,
                    maximum: None,
                    items: None,
                });
            }
            "get_service" => {
                properties.insert("serviceIdentifier".to_string(), PropertySchema {
                    property_type: "string".to_string(),
                    description: Some("Service identifier".to_string()),
                    default: None,
                    minimum: None,
                    maximum: None,
                    items: None,
                });
            }
            "list_connectors" => {
                properties.insert("page".to_string(), PropertySchema {
                    property_type: "number".to_string(),
                    description: Some("Page number for pagination".to_string()),
                    default: Some(json!(0)),
                    minimum: Some(0.0),
                    maximum: None,
                    items: None,
                });
                
                properties.insert("size".to_string(), PropertySchema {
                    property_type: "number".to_string(),
                    description: Some("Page size for pagination".to_string()),
                    default: Some(json!(20)),
                    minimum: Some(1.0),
                    maximum: Some(100.0),
                    items: None,
                });
            }
            _ => {}
        }
        
        properties
    }
    
    fn get_required_properties(&self, tool_name: &str) -> Vec<String> {
        let mut required = vec![];
        
        // Add required properties based on tool name
        match tool_name {
            "list_pipelines" => {
                required.push("orgIdentifier".to_string());
                required.push("projectIdentifier".to_string());
            }
            "get_pipeline" => {
                required.push("pipelineIdentifier".to_string());
                required.push("orgIdentifier".to_string());
                required.push("projectIdentifier".to_string());
            }
            "get_service" => {
                required.push("serviceIdentifier".to_string());
                required.push("orgIdentifier".to_string());
                required.push("projectIdentifier".to_string());
            }
            "list_connectors" => {
                // No required properties for list_connectors
            }
            _ => {}
        }
        
        required
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tools::ToolRegistry;
    use serde_json::json;
    use tokio_test;

    fn create_test_config() -> Config {
        Config {
            version: "test-version".to_string(),
            default_org_id: Some("test-org".to_string()),
            default_project_id: Some("test-project".to_string()),
            ..Default::default()
        }
    }

    fn create_test_server() -> McpServer {
        let config = create_test_config();
        let tool_registry = ToolRegistry::new();
        McpServer::new(config, tool_registry)
    }

    #[tokio::test]
    async fn test_handle_initialize_request() {
        let mut server = create_test_server();
        
        let request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: json!(1),
            method: "initialize".to_string(),
            params: Some(json!({
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {
                    "name": "test-client",
                    "version": "1.0.0"
                }
            })),
        };
        
        let response = server.handle_request(request).await;
        
        assert_eq!(response.jsonrpc, "2.0");
        assert_eq!(response.id, json!(1));
        assert!(response.result.is_some());
        assert!(response.error.is_none());
        
        // Verify the response contains expected fields
        let result = response.result.unwrap();
        assert!(result.get("protocolVersion").is_some());
        assert!(result.get("capabilities").is_some());
        assert!(result.get("serverInfo").is_some());
    }

    #[tokio::test]
    async fn test_handle_initialize_missing_params() {
        let mut server = create_test_server();
        
        let request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: json!(1),
            method: "initialize".to_string(),
            params: None,
        };
        
        let response = server.handle_request(request).await;
        
        assert_eq!(response.jsonrpc, "2.0");
        assert_eq!(response.id, json!(1));
        assert!(response.result.is_none());
        assert!(response.error.is_some());
        
        let error = response.error.unwrap();
        assert_eq!(error.code, -32602);
        assert!(error.message.contains("Missing initialize request parameters"));
    }

    #[tokio::test]
    async fn test_handle_initialized_notification() {
        let mut server = create_test_server();
        
        let request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: json!(1),
            method: "initialized".to_string(),
            params: None,
        };
        
        let response = server.handle_request(request).await;
        
        assert_eq!(response.jsonrpc, "2.0");
        assert_eq!(response.id, json!(1));
        assert!(response.result.is_some());
        assert!(response.error.is_none());
        assert!(server.initialized);
    }

    #[tokio::test]
    async fn test_handle_list_tools_not_initialized() {
        let mut server = create_test_server();
        
        let request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: json!(1),
            method: "tools/list".to_string(),
            params: None,
        };
        
        let response = server.handle_request(request).await;
        
        assert_eq!(response.jsonrpc, "2.0");
        assert_eq!(response.id, json!(1));
        assert!(response.result.is_none());
        assert!(response.error.is_some());
        
        let error = response.error.unwrap();
        assert_eq!(error.code, -32002);
        assert!(error.message.contains("Server not initialized"));
    }

    #[tokio::test]
    async fn test_handle_list_tools_initialized() {
        let mut server = create_test_server();
        server.initialized = true;
        
        let request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: json!(1),
            method: "tools/list".to_string(),
            params: None,
        };
        
        let response = server.handle_request(request).await;
        
        assert_eq!(response.jsonrpc, "2.0");
        assert_eq!(response.id, json!(1));
        assert!(response.result.is_some());
        assert!(response.error.is_none());
        
        let result = response.result.unwrap();
        assert!(result.get("tools").is_some());
    }

    #[tokio::test]
    async fn test_handle_unknown_method() {
        let mut server = create_test_server();
        
        let request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: json!(1),
            method: "unknown/method".to_string(),
            params: None,
        };
        
        let response = server.handle_request(request).await;
        
        assert_eq!(response.jsonrpc, "2.0");
        assert_eq!(response.id, json!(1));
        assert!(response.result.is_none());
        assert!(response.error.is_some());
        
        let error = response.error.unwrap();
        assert_eq!(error.code, -32601);
        assert!(error.message.contains("Method not found"));
    }

    #[test]
    fn test_get_tool_properties_list_pipelines() {
        let server = create_test_server();
        let properties = server.get_tool_properties("list_pipelines");
        
        assert!(properties.contains_key("orgIdentifier"));
        assert!(properties.contains_key("projectIdentifier"));
        assert!(properties.contains_key("page"));
        assert!(properties.contains_key("size"));
        assert!(properties.contains_key("searchTerm"));
        assert!(properties.contains_key("filterIdentifier"));
        
        // Check default values
        let page_prop = &properties["page"];
        assert_eq!(page_prop.default, Some(json!(0)));
        
        let size_prop = &properties["size"];
        assert_eq!(size_prop.default, Some(json!(20)));
    }

    #[test]
    fn test_get_required_properties_list_pipelines() {
        let server = create_test_server();
        let required = server.get_required_properties("list_pipelines");
        
        assert_eq!(required.len(), 2);
        assert!(required.contains(&"orgIdentifier".to_string()));
        assert!(required.contains(&"projectIdentifier".to_string()));
    }

    #[test]
    fn test_get_required_properties_get_pipeline() {
        let server = create_test_server();
        let required = server.get_required_properties("get_pipeline");
        
        assert_eq!(required.len(), 3);
        assert!(required.contains(&"pipelineIdentifier".to_string()));
        assert!(required.contains(&"orgIdentifier".to_string()));
        assert!(required.contains(&"projectIdentifier".to_string()));
    }

    #[test]
    fn test_get_required_properties_list_connectors() {
        let server = create_test_server();
        let required = server.get_required_properties("list_connectors");
        
        assert_eq!(required.len(), 0);
    }
}