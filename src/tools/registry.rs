use anyhow::Result;
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{debug, info};

use crate::config::Config;
use crate::mcp::{CallToolRequest, CallToolResult, Content, ToolDefinition};
use crate::tools::{Tool, ToolHandler};
use std::sync::Arc;

pub struct ToolRegistry {
    tools: HashMap<String, Tool>,
}

impl ToolRegistry {
    pub fn new() -> Self {
        Self {
            tools: HashMap::new(),
        }
    }
    
    pub fn register_tool(&mut self, tool: Tool) {
        let name = tool.definition.name.clone();
        debug!("Registering tool: {}", name);
        self.tools.insert(name, tool);
    }
    
    pub async fn register_default_tools(&mut self, config: &Config) -> Result<()> {
        info!("Registering default tools based on configuration");
        
        // Register pipeline tools if enabled
        if self.should_enable_toolset(config, "pipelines") {
            self.register_pipeline_tools(config).await?;
        }
        
        // Register dashboard tools if enabled
        if self.should_enable_toolset(config, "dashboards") {
            self.register_dashboard_tools(config).await?;
        }
        
        // Register repository tools if enabled
        if self.should_enable_toolset(config, "repositories") {
            self.register_repository_tools(config).await?;
        }
        
        // Additional toolsets would be registered here...
        
        Ok(())
    }
    
    fn should_enable_toolset(&self, config: &Config, toolset: &str) -> bool {
        // If no specific toolsets are configured, enable all
        if config.toolsets.is_empty() {
            return true;
        }
        
        // Check if this toolset is explicitly enabled
        config.toolsets.contains(&toolset.to_string())
    }
    
    async fn register_pipeline_tools(&mut self, config: &Config) -> Result<()> {
        use crate::tools::pipelines::*;
        
        // List pipelines tool
        let list_pipelines_tool = create_list_pipelines_tool(config).await?;
        self.register_tool(list_pipelines_tool);
        
        // Get pipeline tool
        let get_pipeline_tool = create_get_pipeline_tool(config).await?;
        self.register_tool(get_pipeline_tool);
        
        // Execute pipeline tool (if not read-only)
        if !config.read_only {
            let execute_pipeline_tool = create_execute_pipeline_tool(config).await?;
            self.register_tool(execute_pipeline_tool);
        }
        
        info!("Registered pipeline tools");
        Ok(())
    }
    
    async fn register_dashboard_tools(&mut self, config: &Config) -> Result<()> {
        use crate::tools::dashboards::*;
        
        // List dashboards tool
        let list_dashboards_tool = create_list_dashboards_tool(config).await?;
        self.register_tool(list_dashboards_tool);
        
        // Get dashboard tool
        let get_dashboard_tool = create_get_dashboard_tool(config).await?;
        self.register_tool(get_dashboard_tool);
        
        info!("Registered dashboard tools");
        Ok(())
    }
    
    async fn register_repository_tools(&mut self, config: &Config) -> Result<()> {
        use crate::tools::repositories::*;
        
        // List repositories tool
        let list_repositories_tool = create_list_repositories_tool(config).await?;
        self.register_tool(list_repositories_tool);
        
        // Get repository tool
        let get_repository_tool = create_get_repository_tool(config).await?;
        self.register_tool(get_repository_tool);
        
        info!("Registered repository tools");
        Ok(())
    }
    
    pub fn list_tools(&self) -> Vec<ToolDefinition> {
        self.tools
            .values()
            .map(|tool| tool.definition.clone())
            .collect()
    }
    
    pub async fn call_tool(&self, request: &CallToolRequest) -> Result<CallToolResult> {
        let tool = self
            .tools
            .get(&request.name)
            .ok_or_else(|| anyhow::anyhow!("Tool not found: {}", request.name))?;
        
        debug!("Calling tool: {}", request.name);
        
        match tool.handler.call(request).await {
            Ok(result) => {
                debug!("Tool {} completed successfully", request.name);
                Ok(result)
            }
            Err(e) => {
                debug!("Tool {} failed: {}", request.name, e);
                Ok(CallToolResult::error(format!("Tool execution failed: {}", e)))
            }
        }
    }
    
    pub fn count(&self) -> usize {
        self.tools.len()
    }
}