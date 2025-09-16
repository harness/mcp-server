use crate::mcp::{Tool, ToolResult, ToolContent};
use anyhow::Result;
use async_trait::async_trait;
use harness_mcp_config::Config;
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{debug, error};

/// Tool handler trait
#[async_trait]
pub trait ToolHandler: Send + Sync {
    /// Execute the tool with the given arguments
    async fn execute(&self, arguments: HashMap<String, serde_json::Value>) -> Result<ToolResult>;
}

/// Tool definition with handler
pub struct ToolDefinition {
    pub tool: Tool,
    pub handler: Arc<dyn ToolHandler>,
}

/// A collection of related tools
pub struct Toolset {
    pub name: String,
    pub description: String,
    pub tools: Vec<ToolDefinition>,
}

impl Toolset {
    /// Create a new toolset
    pub fn new(name: String, description: String) -> Self {
        Self {
            name,
            description,
            tools: Vec::new(),
        }
    }

    /// Add a tool to this toolset
    pub fn add_tool(mut self, tool: Tool, handler: Arc<dyn ToolHandler>) -> Self {
        self.tools.push(ToolDefinition { tool, handler });
        self
    }

    /// Get all tools in this toolset
    pub fn get_tools(&self) -> Vec<Tool> {
        self.tools.iter().map(|td| td.tool.clone()).collect()
    }

    /// Find a tool by name
    pub fn find_tool(&self, name: &str) -> Option<&ToolDefinition> {
        self.tools.iter().find(|td| td.tool.name == name)
    }
}

/// Group of toolsets
pub struct ToolsetGroup {
    toolsets: HashMap<String, Toolset>,
    enabled_toolsets: Vec<String>,
}

impl ToolsetGroup {
    /// Create a new toolset group
    pub async fn new(config: &Config) -> Result<Self> {
        let mut group = Self {
            toolsets: HashMap::new(),
            enabled_toolsets: config.toolsets.clone(),
        };

        // Register default toolsets based on configuration
        group.register_default_toolsets(config).await?;

        Ok(group)
    }

    /// Register default toolsets
    async fn register_default_toolsets(&mut self, config: &Config) -> Result<()> {
        // Register default toolset if enabled
        if config.is_toolset_enabled("default") {
            let default_toolset = create_default_toolset(config).await?;
            self.add_toolset(default_toolset);
        }

        // Register pipelines toolset if enabled
        if config.is_toolset_enabled("pipelines") {
            let pipelines_toolset = create_pipelines_toolset(config).await?;
            self.add_toolset(pipelines_toolset);
        }

        // Register connectors toolset if enabled
        if config.is_toolset_enabled("connectors") {
            let connectors_toolset = create_connectors_toolset(config).await?;
            self.add_toolset(connectors_toolset);
        }

        Ok(())
    }

    /// Add a toolset to the group
    pub fn add_toolset(&mut self, toolset: Toolset) {
        let name = toolset.name.clone();
        self.toolsets.insert(name, toolset);
    }

    /// Get all tools from enabled toolsets
    pub fn get_tools(&self) -> Vec<Tool> {
        let mut tools = Vec::new();
        for toolset_name in &self.enabled_toolsets {
            if let Some(toolset) = self.toolsets.get(toolset_name) {
                tools.extend(toolset.get_tools());
            }
        }
        tools
    }

    /// Call a tool by name
    pub async fn call_tool(
        &self,
        tool_name: &str,
        arguments: HashMap<String, serde_json::Value>,
    ) -> Result<ToolResult> {
        debug!("Calling tool: {}", tool_name);

        // Find the tool in any enabled toolset
        for toolset_name in &self.enabled_toolsets {
            if let Some(toolset) = self.toolsets.get(toolset_name) {
                if let Some(tool_def) = toolset.find_tool(tool_name) {
                    debug!("Found tool {} in toolset {}", tool_name, toolset_name);
                    return tool_def.handler.execute(arguments).await;
                }
            }
        }

        error!("Tool not found: {}", tool_name);
        Err(anyhow::anyhow!("Tool not found: {}", tool_name))
    }
}

/// Create default toolset
async fn create_default_toolset(_config: &Config) -> Result<Toolset> {
    let mut toolset = Toolset::new("default".to_string(), "Default Harness tools".to_string());

    // Add a simple echo tool for testing
    let echo_tool = Tool {
        name: "echo".to_string(),
        description: "Echo the input message".to_string(),
        input_schema: crate::mcp::ToolInputSchema {
            schema_type: "object".to_string(),
            properties: {
                let mut props = HashMap::new();
                props.insert(
                    "message".to_string(),
                    crate::mcp::ToolProperty {
                        property_type: "string".to_string(),
                        description: Some("Message to echo".to_string()),
                        enum_values: None,
                    },
                );
                props
            },
            required: Some(vec!["message".to_string()]),
        },
    };

    toolset = toolset.add_tool(echo_tool, Arc::new(EchoToolHandler));

    Ok(toolset)
}

/// Create pipelines toolset
async fn create_pipelines_toolset(config: &Config) -> Result<Toolset> {
    let mut toolset = Toolset::new("pipelines".to_string(), "Pipeline management tools".to_string());
    
    // Create HTTP client for pipeline service
    if let Some(base_url) = config.base_url() {
        if let Some(api_key) = config.api_key() {
            let auth_provider = Box::new(harness_mcp_auth::ApiKeyProvider::new(api_key.to_string()));
            let client = harness_mcp_client::ClientBuilder::new()
                .base_url(base_url.clone())
                .auth_provider(auth_provider)
                .build()
                .map_err(|e| anyhow::anyhow!("Failed to create client: {}", e))?;
            
            let pipeline_tools = crate::pipelines::create_pipeline_toolset(client);
            for tool_def in pipeline_tools {
                toolset = toolset.add_tool(tool_def.tool, tool_def.handler);
            }
        }
    }
    
    Ok(toolset)
}

/// Create connectors toolset
async fn create_connectors_toolset(config: &Config) -> Result<Toolset> {
    let mut toolset = Toolset::new("connectors".to_string(), "Connector management tools".to_string());
    
    // Create HTTP client for connector service
    if let Some(base_url) = config.base_url() {
        if let Some(api_key) = config.api_key() {
            let auth_provider = Box::new(harness_mcp_auth::ApiKeyProvider::new(api_key.to_string()));
            let client = harness_mcp_client::ClientBuilder::new()
                .base_url(base_url.clone())
                .auth_provider(auth_provider)
                .build()
                .map_err(|e| anyhow::anyhow!("Failed to create client: {}", e))?;
            
            let connector_tools = crate::connectors::create_connector_toolset(client);
            for tool_def in connector_tools {
                toolset = toolset.add_tool(tool_def.tool, tool_def.handler);
            }
        }
    }
    
    Ok(toolset)
}

/// Simple echo tool handler for testing
struct EchoToolHandler;

#[async_trait]
impl ToolHandler for EchoToolHandler {
    async fn execute(&self, arguments: HashMap<String, serde_json::Value>) -> Result<ToolResult> {
        let message = arguments
            .get("message")
            .and_then(|v| v.as_str())
            .unwrap_or("No message provided");

        Ok(ToolResult {
            content: vec![ToolContent::Text {
                text: format!("Echo: {}", message),
            }],
            is_error: Some(false),
        })
    }
}

// Re-export MCP types for convenience
pub use crate::mcp::{Tool, ToolResult, ToolContent, ToolInputSchema, ToolProperty};

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_toolset_creation() {
        let toolset = Toolset::new("test".to_string(), "Test toolset".to_string());
        assert_eq!(toolset.name, "test");
        assert_eq!(toolset.description, "Test toolset");
        assert!(toolset.tools.is_empty());
    }

    #[tokio::test]
    async fn test_echo_tool_handler() {
        let handler = EchoToolHandler;
        let mut args = HashMap::new();
        args.insert("message".to_string(), serde_json::Value::String("Hello".to_string()));

        let result = handler.execute(args).await.unwrap();
        assert_eq!(result.content.len(), 1);
        if let ToolContent::Text { text } = &result.content[0] {
            assert_eq!(text, "Echo: Hello");
        } else {
            panic!("Expected text content");
        }
    }

    #[tokio::test]
    async fn test_toolset_group_creation() {
        let config = Config::default();
        let group = ToolsetGroup::new(&config).await;
        assert!(group.is_ok());
    }
}