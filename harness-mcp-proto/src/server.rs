//! MCP server implementation

use crate::{
    error::{McpError, Result},
    types::*,
};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, error, info};

/// Handler function for tool calls
pub type ToolHandler = Arc<dyn Fn(CallToolRequest) -> Result<CallToolResult> + Send + Sync>;

/// Handler function for prompt requests
pub type PromptHandler = Arc<dyn Fn(GetPromptRequest) -> Result<GetPromptResponse> + Send + Sync>;

/// Handler function for resource requests
pub type ResourceHandler = Arc<dyn Fn(ReadResourceRequest) -> Result<ReadResourceResponse> + Send + Sync>;

/// MCP server implementation
#[derive(Clone)]
pub struct McpServer {
    server_info: ServerInfo,
    capabilities: ServerCapabilities,
    tools: Arc<RwLock<HashMap<String, (Tool, ToolHandler)>>>,
    prompts: Arc<RwLock<HashMap<String, (Prompt, PromptHandler)>>>,
    resources: Arc<RwLock<HashMap<String, (Resource, ResourceHandler)>>>,
    initialized: Arc<RwLock<bool>>,
}

impl McpServer {
    /// Create a new MCP server
    pub fn new(name: String, version: String) -> Self {
        Self {
            server_info: ServerInfo { name, version },
            capabilities: ServerCapabilities::default(),
            tools: Arc::new(RwLock::new(HashMap::new())),
            prompts: Arc::new(RwLock::new(HashMap::new())),
            resources: Arc::new(RwLock::new(HashMap::new())),
            initialized: Arc::new(RwLock::new(false)),
        }
    }

    /// Set server capabilities
    pub fn with_capabilities(mut self, capabilities: ServerCapabilities) -> Self {
        self.capabilities = capabilities;
        self
    }

    /// Add a tool to the server
    pub async fn add_tool(&self, tool: Tool, handler: ToolHandler) {
        let mut tools = self.tools.write().await;
        tools.insert(tool.name.clone(), (tool, handler));
    }

    /// Add a prompt to the server
    pub async fn add_prompt(&self, prompt: Prompt, handler: PromptHandler) {
        let mut prompts = self.prompts.write().await;
        prompts.insert(prompt.name.clone(), (prompt, handler));
    }

    /// Add a resource to the server
    pub async fn add_resource(&self, resource: Resource, handler: ResourceHandler) {
        let mut resources = self.resources.write().await;
        resources.insert(resource.uri.clone(), (resource, handler));
    }

    /// Handle an MCP request
    pub async fn handle_request(&self, request: JsonRpcRequest) -> JsonRpcResponse {
        let id = request.id.clone();
        
        match self.process_request(request).await {
            Ok(result) => JsonRpcResponse {
                jsonrpc: "2.0".to_string(),
                id,
                result: Some(result),
                error: None,
            },
            Err(error) => {
                error!("Request failed: {}", error);
                JsonRpcResponse {
                    jsonrpc: "2.0".to_string(),
                    id,
                    result: None,
                    error: Some(JsonRpcError {
                        code: error.code(),
                        message: error.to_string(),
                        data: None,
                    }),
                }
            }
        }
    }

    async fn process_request(&self, request: JsonRpcRequest) -> Result<Value> {
        debug!("Processing request: {}", request.method);

        match request.method.as_str() {
            "initialize" => self.handle_initialize(request.params).await,
            "tools/list" => self.handle_list_tools(request.params).await,
            "tools/call" => self.handle_call_tool(request.params).await,
            "prompts/list" => self.handle_list_prompts(request.params).await,
            "prompts/get" => self.handle_get_prompt(request.params).await,
            "resources/list" => self.handle_list_resources(request.params).await,
            "resources/read" => self.handle_read_resource(request.params).await,
            _ => Err(McpError::MethodNotFound(request.method)),
        }
    }

    async fn handle_initialize(&self, params: Option<Value>) -> Result<Value> {
        let request: InitializeRequest = match params {
            Some(p) => serde_json::from_value(p)?,
            None => return Err(McpError::InvalidParams("Missing parameters".to_string())),
        };

        info!("Client connected: {} v{}", request.client_info.name, request.client_info.version);

        let mut initialized = self.initialized.write().await;
        *initialized = true;

        let response = InitializeResponse {
            protocol_version: crate::MCP_VERSION.to_string(),
            capabilities: self.capabilities.clone(),
            server_info: self.server_info.clone(),
        };

        Ok(serde_json::to_value(response)?)
    }

    async fn handle_list_tools(&self, params: Option<Value>) -> Result<Value> {
        self.ensure_initialized().await?;

        let _request: ListToolsRequest = match params {
            Some(p) => serde_json::from_value(p)?,
            None => ListToolsRequest { cursor: None },
        };

        let tools = self.tools.read().await;
        let tool_list: Vec<Tool> = tools.values().map(|(tool, _)| tool.clone()).collect();

        let response = ListToolsResponse {
            tools: tool_list,
            next_cursor: None,
        };

        Ok(serde_json::to_value(response)?)
    }

    async fn handle_call_tool(&self, params: Option<Value>) -> Result<Value> {
        self.ensure_initialized().await?;

        let request: CallToolRequest = match params {
            Some(p) => serde_json::from_value(p)?,
            None => return Err(McpError::InvalidParams("Missing parameters".to_string())),
        };

        let tools = self.tools.read().await;
        let (_, handler) = tools
            .get(&request.name)
            .ok_or_else(|| McpError::MethodNotFound(format!("Tool not found: {}", request.name)))?;

        let result = handler(request)?;
        Ok(serde_json::to_value(result)?)
    }

    async fn handle_list_prompts(&self, params: Option<Value>) -> Result<Value> {
        self.ensure_initialized().await?;

        let _request: ListPromptsRequest = match params {
            Some(p) => serde_json::from_value(p)?,
            None => ListPromptsRequest { cursor: None },
        };

        let prompts = self.prompts.read().await;
        let prompt_list: Vec<Prompt> = prompts.values().map(|(prompt, _)| prompt.clone()).collect();

        let response = ListPromptsResponse {
            prompts: prompt_list,
            next_cursor: None,
        };

        Ok(serde_json::to_value(response)?)
    }

    async fn handle_get_prompt(&self, params: Option<Value>) -> Result<Value> {
        self.ensure_initialized().await?;

        let request: GetPromptRequest = match params {
            Some(p) => serde_json::from_value(p)?,
            None => return Err(McpError::InvalidParams("Missing parameters".to_string())),
        };

        let prompts = self.prompts.read().await;
        let (_, handler) = prompts
            .get(&request.name)
            .ok_or_else(|| McpError::MethodNotFound(format!("Prompt not found: {}", request.name)))?;

        let result = handler(request)?;
        Ok(serde_json::to_value(result)?)
    }

    async fn handle_list_resources(&self, params: Option<Value>) -> Result<Value> {
        self.ensure_initialized().await?;

        let _request: ListResourcesRequest = match params {
            Some(p) => serde_json::from_value(p)?,
            None => ListResourcesRequest { cursor: None },
        };

        let resources = self.resources.read().await;
        let resource_list: Vec<Resource> = resources.values().map(|(resource, _)| resource.clone()).collect();

        let response = ListResourcesResponse {
            resources: resource_list,
            next_cursor: None,
        };

        Ok(serde_json::to_value(response)?)
    }

    async fn handle_read_resource(&self, params: Option<Value>) -> Result<Value> {
        self.ensure_initialized().await?;

        let request: ReadResourceRequest = match params {
            Some(p) => serde_json::from_value(p)?,
            None => return Err(McpError::InvalidParams("Missing parameters".to_string())),
        };

        let resources = self.resources.read().await;
        let (_, handler) = resources
            .get(&request.uri)
            .ok_or_else(|| McpError::MethodNotFound(format!("Resource not found: {}", request.uri)))?;

        let result = handler(request)?;
        Ok(serde_json::to_value(result)?)
    }

    async fn ensure_initialized(&self) -> Result<()> {
        let initialized = self.initialized.read().await;
        if !*initialized {
            return Err(McpError::InvalidRequest("Server not initialized".to_string()));
        }
        Ok(())
    }
}