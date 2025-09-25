//! MCP server implementation

use crate::types::*;
use crate::error::{Error, Result};
use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Tool handler function type
pub type ToolHandler = Arc<dyn Fn(ToolCallRequest) -> futures::future::BoxFuture<'static, Result<ToolCallResult>> + Send + Sync>;

/// MCP server trait
#[async_trait]
pub trait McpServer: Send + Sync {
    async fn list_tools(&self) -> Result<Vec<Tool>>;
    async fn call_tool(&self, request: ToolCallRequest) -> Result<ToolCallResult>;
    async fn get_capabilities(&self) -> Result<ServerCapabilities>;
    async fn list_resources(&self) -> Result<Vec<Resource>>;
    async fn read_resource(&self, uri: &str) -> Result<Vec<ResourceContents>>;
    async fn list_prompts(&self) -> Result<Vec<Prompt>>;
    async fn get_prompt(&self, name: &str, arguments: Option<HashMap<String, String>>) -> Result<GetPromptResponse>;
}

/// Default MCP server implementation
pub struct DefaultMcpServer {
    tools: Arc<RwLock<HashMap<String, Tool>>>,
    tool_handlers: Arc<RwLock<HashMap<String, ToolHandler>>>,
    resources: Arc<RwLock<Vec<Resource>>>,
    prompts: Arc<RwLock<Vec<Prompt>>>,
}

impl DefaultMcpServer {
    pub fn new() -> Self {
        Self {
            tools: Arc::new(RwLock::new(HashMap::new())),
            tool_handlers: Arc::new(RwLock::new(HashMap::new())),
            resources: Arc::new(RwLock::new(Vec::new())),
            prompts: Arc::new(RwLock::new(Vec::new())),
        }
    }

    pub async fn add_tool(&self, tool: Tool, handler: ToolHandler) {
        let mut tools = self.tools.write().await;
        let mut handlers = self.tool_handlers.write().await;
        
        handlers.insert(tool.name.clone(), handler);
        tools.insert(tool.name.clone(), tool);
    }

    pub async fn add_resource(&self, resource: Resource) {
        let mut resources = self.resources.write().await;
        resources.push(resource);
    }

    pub async fn add_prompt(&self, prompt: Prompt) {
        let mut prompts = self.prompts.write().await;
        prompts.push(prompt);
    }
}

impl Default for DefaultMcpServer {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl McpServer for DefaultMcpServer {
    async fn list_tools(&self) -> Result<Vec<Tool>> {
        let tools = self.tools.read().await;
        Ok(tools.values().cloned().collect())
    }

    async fn call_tool(&self, request: ToolCallRequest) -> Result<ToolCallResult> {
        let handlers = self.tool_handlers.read().await;
        
        if let Some(handler) = handlers.get(&request.name) {
            let handler = handler.clone();
            drop(handlers); // Release the lock before calling the handler
            handler(request).await
        } else {
            Err(Error::ToolExecution(format!("Tool not found: {}", request.name)))
        }
    }

    async fn get_capabilities(&self) -> Result<ServerCapabilities> {
        Ok(ServerCapabilities {
            experimental: None,
            logging: Some(LoggingCapabilities {}),
            prompts: Some(PromptsCapabilities {
                list_changed: Some(true),
            }),
            resources: Some(ResourcesCapabilities {
                subscribe: Some(true),
                list_changed: Some(true),
            }),
            tools: Some(ToolsCapabilities {
                list_changed: Some(true),
            }),
        })
    }

    async fn list_resources(&self) -> Result<Vec<Resource>> {
        let resources = self.resources.read().await;
        Ok(resources.clone())
    }

    async fn read_resource(&self, _uri: &str) -> Result<Vec<ResourceContents>> {
        // TODO: Implement resource reading
        Ok(vec![])
    }

    async fn list_prompts(&self) -> Result<Vec<Prompt>> {
        let prompts = self.prompts.read().await;
        Ok(prompts.clone())
    }

    async fn get_prompt(&self, _name: &str, _arguments: Option<HashMap<String, String>>) -> Result<GetPromptResponse> {
        // TODO: Implement prompt retrieval
        Ok(GetPromptResponse {
            description: None,
            messages: vec![],
        })
    }
}