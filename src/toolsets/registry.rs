use crate::client::HttpClient;
use crate::mcp::{McpServer, ToolHandler};
use crate::toolsets::{pipelines, connectors};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{info, warn};

pub struct ToolsetRegistry {
    toolsets: HashMap<String, Vec<Box<dyn ToolHandler + Send + Sync>>>,
}

impl ToolsetRegistry {
    pub fn new() -> Self {
        Self {
            toolsets: HashMap::new(),
        }
    }

    pub fn register_toolset(&mut self, name: String, tools: Vec<Box<dyn ToolHandler + Send + Sync>>) {
        info!("Registering toolset '{}' with {} tools", name, tools.len());
        self.toolsets.insert(name, tools);
    }

    pub async fn register_tools_with_server(&self, server: &McpServer, enabled_toolsets: &[String]) {
        for toolset_name in enabled_toolsets {
            if let Some(tools) = self.toolsets.get(toolset_name) {
                info!("Registering {} tools from toolset '{}'", tools.len(), toolset_name);
                for tool in tools {
                    let tool_name = tool.definition().name.clone();
                    // Note: We can't move the tool out of the vector, so we'd need to restructure
                    // this to work with the async server. For now, we'll create tools directly.
                    warn!("Tool registration needs refactoring for async server: {}", tool_name);
                }
            } else {
                warn!("Toolset '{}' not found in registry", toolset_name);
            }
        }
    }

    pub fn create_default_registry(client: HttpClient) -> Self {
        let mut registry = Self::new();
        
        // Register pipeline toolset
        registry.register_toolset(
            "pipelines".to_string(),
            pipelines::create_pipeline_toolset(client.clone()),
        );

        // Register connector toolset
        registry.register_toolset(
            "connectors".to_string(),
            connectors::create_connector_toolset(client.clone()),
        );

        registry
    }

    pub fn get_available_toolsets(&self) -> Vec<String> {
        self.toolsets.keys().cloned().collect()
    }

    pub fn get_toolset_tool_count(&self, toolset_name: &str) -> usize {
        self.toolsets.get(toolset_name).map_or(0, |tools| tools.len())
    }
}

impl Default for ToolsetRegistry {
    fn default() -> Self {
        Self::new()
    }
}