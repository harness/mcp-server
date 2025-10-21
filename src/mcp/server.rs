use crate::mcp::types::*;
use crate::mcp::protocol::*;
use crate::tools::ToolHandler;
use crate::error::{HarnessError, Result};
use serde_json::{Value, json};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{debug, error, info, warn};

pub struct McpServer {
    pub name: String,
    pub version: String,
    pub capabilities: ServerCapabilities,
    pub tools: HashMap<String, (Tool, Arc<dyn ToolHandler>)>,
    pub resources: HashMap<String, Resource>,
    pub prompts: HashMap<String, Prompt>,
    pub initialized: bool,
}

impl McpServer {
    pub fn new(version: &str) -> Self {
        Self {
            name: "harness-mcp-server".to_string(),
            version: version.to_string(),
            capabilities: create_default_server_capabilities(),
            tools: HashMap::new(),
            resources: HashMap::new(),
            prompts: HashMap::new(),
            initialized: false,
        }
    }
    
    pub fn add_tool(&mut self, tool: Tool, handler: Arc<dyn ToolHandler>) {
        debug!("Registering tool: {}", tool.name);
        self.tools.insert(tool.name.clone(), (tool, handler));
    }
    
    pub fn add_resource(&mut self, resource: Resource) {
        debug!("Registering resource: {}", resource.uri);
        self.resources.insert(resource.uri.clone(), resource);
    }
    
    pub fn add_prompt(&mut self, prompt: Prompt) {
        debug!("Registering prompt: {}", prompt.name);
        self.prompts.insert(prompt.name.clone(), prompt);
    }
    
    pub async fn handle_request(&self, request: Value) -> Result<Value> {
        let req: JsonRpcRequest = serde_json::from_value(request)
            .map_err(|e| HarnessError::Json(e))?;
        
        debug!("Handling request: method={}, id={:?}", req.method, req.id);
        
        let response = match req.method.as_str() {
            METHOD_INITIALIZE => self.handle_initialize(req.id, req.params).await,
            METHOD_TOOLS_LIST => self.handle_tools_list(req.id, req.params).await,
            METHOD_TOOLS_CALL => self.handle_tools_call(req.id, req.params).await,
            METHOD_RESOURCES_LIST => self.handle_resources_list(req.id, req.params).await,
            METHOD_RESOURCES_READ => self.handle_resources_read(req.id, req.params).await,
            METHOD_PROMPTS_LIST => self.handle_prompts_list(req.id, req.params).await,
            METHOD_PROMPTS_GET => self.handle_prompts_get(req.id, req.params).await,
            METHOD_LOGGING_SET_LEVEL => self.handle_logging_set_level(req.id, req.params).await,
            _ => {
                warn!("Unknown method: {}", req.method);
                Ok(create_error_response(
                    req.id,
                    JSONRPC_METHOD_NOT_FOUND,
                    "Method not found",
                    None,
                ))
            }
        };
        
        match response {
            Ok(resp) => Ok(serde_json::to_value(resp)?),
            Err(e) => {
                error!("Error handling request: {}", e);
                Ok(serde_json::to_value(create_error_response(
                    req.id,
                    JSONRPC_INTERNAL_ERROR,
                    "Internal error",
                    Some(json!(e.to_string())),
                ))?)
            }
        }
    }
    
    async fn handle_initialize(&self, id: Option<Value>, params: Option<Value>) -> Result<JsonRpcResponse> {
        debug!("Handling initialize request");
        
        let _init_req: InitializeRequest = match params {
            Some(p) => serde_json::from_value(p)?,
            None => return Ok(create_error_response(
                id,
                JSONRPC_INVALID_PARAMS,
                "Missing initialization parameters",
                None,
            )),
        };
        
        let result = InitializeResult {
            protocol_version: PROTOCOL_VERSION.to_string(),
            capabilities: self.capabilities.clone(),
            server_info: ServerInfo {
                name: self.name.clone(),
                version: self.version.clone(),
            },
        };
        
        info!("Server initialized successfully");
        Ok(create_success_response(id, serde_json::to_value(result)?))
    }
    
    async fn handle_tools_list(&self, id: Option<Value>, _params: Option<Value>) -> Result<JsonRpcResponse> {
        debug!("Handling tools/list request");
        
        let tools: Vec<Tool> = self.tools.values().map(|(tool, _)| tool.clone()).collect();
        
        let result = json!({
            "tools": tools
        });
        
        Ok(create_success_response(id, result))
    }
    
    async fn handle_tools_call(&self, id: Option<Value>, params: Option<Value>) -> Result<JsonRpcResponse> {
        debug!("Handling tools/call request");
        
        let call: ToolCall = match params {
            Some(p) => serde_json::from_value(p)?,
            None => return Ok(create_error_response(
                id,
                JSONRPC_INVALID_PARAMS,
                "Missing tool call parameters",
                None,
            )),
        };
        
        match self.tools.get(&call.name) {
            Some((_, handler)) => {
                // TODO: Pass actual config
                let config = crate::config::Config::from_cli(&crate::cli::Cli::parse())?;
                
                match handler.handle(call, &config).await {
                    Ok(result) => Ok(create_success_response(id, serde_json::to_value(result)?)),
                    Err(e) => Ok(create_error_response(
                        id,
                        MCP_TOOL_EXECUTION_ERROR,
                        "Tool execution failed",
                        Some(json!(e.to_string())),
                    )),
                }
            }
            None => Ok(create_error_response(
                id,
                MCP_INVALID_TOOL,
                &format!("Tool '{}' not found", call.name),
                None,
            )),
        }
    }
    
    async fn handle_resources_list(&self, id: Option<Value>, _params: Option<Value>) -> Result<JsonRpcResponse> {
        debug!("Handling resources/list request");
        
        let resources: Vec<Resource> = self.resources.values().cloned().collect();
        
        let result = json!({
            "resources": resources
        });
        
        Ok(create_success_response(id, result))
    }
    
    async fn handle_resources_read(&self, id: Option<Value>, params: Option<Value>) -> Result<JsonRpcResponse> {
        debug!("Handling resources/read request");
        
        let read_req: Value = match params {
            Some(p) => p,
            None => return Ok(create_error_response(
                id,
                JSONRPC_INVALID_PARAMS,
                "Missing resource read parameters",
                None,
            )),
        };
        
        let uri = read_req.get("uri")
            .and_then(|v| v.as_str())
            .ok_or_else(|| HarnessError::InvalidParameter("Missing uri parameter".to_string()))?;
        
        match self.resources.get(uri) {
            Some(_resource) => {
                // TODO: Implement resource reading
                let result = json!({
                    "contents": []
                });
                Ok(create_success_response(id, result))
            }
            None => Ok(create_error_response(
                id,
                MCP_RESOURCE_NOT_FOUND,
                &format!("Resource '{}' not found", uri),
                None,
            )),
        }
    }
    
    async fn handle_prompts_list(&self, id: Option<Value>, _params: Option<Value>) -> Result<JsonRpcResponse> {
        debug!("Handling prompts/list request");
        
        let prompts: Vec<Prompt> = self.prompts.values().cloned().collect();
        
        let result = json!({
            "prompts": prompts
        });
        
        Ok(create_success_response(id, result))
    }
    
    async fn handle_prompts_get(&self, id: Option<Value>, params: Option<Value>) -> Result<JsonRpcResponse> {
        debug!("Handling prompts/get request");
        
        let get_req: Value = match params {
            Some(p) => p,
            None => return Ok(create_error_response(
                id,
                JSONRPC_INVALID_PARAMS,
                "Missing prompt get parameters",
                None,
            )),
        };
        
        let name = get_req.get("name")
            .and_then(|v| v.as_str())
            .ok_or_else(|| HarnessError::InvalidParameter("Missing name parameter".to_string()))?;
        
        match self.prompts.get(name) {
            Some(_prompt) => {
                // TODO: Implement prompt generation
                let result = json!({
                    "description": format!("Prompt: {}", name),
                    "messages": []
                });
                Ok(create_success_response(id, result))
            }
            None => Ok(create_error_response(
                id,
                MCP_PROMPT_NOT_FOUND,
                &format!("Prompt '{}' not found", name),
                None,
            )),
        }
    }
    
    async fn handle_logging_set_level(&self, id: Option<Value>, params: Option<Value>) -> Result<JsonRpcResponse> {
        debug!("Handling logging/setLevel request");
        
        let level_req: Value = match params {
            Some(p) => p,
            None => return Ok(create_error_response(
                id,
                JSONRPC_INVALID_PARAMS,
                "Missing logging level parameters",
                None,
            )),
        };
        
        let _level = level_req.get("level")
            .and_then(|v| v.as_str())
            .ok_or_else(|| HarnessError::InvalidParameter("Missing level parameter".to_string()))?;
        
        // TODO: Implement dynamic log level setting
        info!("Log level change requested");
        
        let result = json!({});
        Ok(create_success_response(id, result))
    }
}