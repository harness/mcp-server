use crate::config::Config;
use crate::error::Result;
use crate::mcp::McpServer;
use crate::tools::pipelines::PipelineTools;
use crate::tools::connectors::ConnectorTools;
use std::sync::Arc;
use tracing::{info, debug};

pub struct ToolsetRegistry {
    config: Config,
}

impl ToolsetRegistry {
    pub fn new(config: Config) -> Self {
        Self { config }
    }
    
    pub fn register_tools(&self, server: &mut McpServer) -> Result<()> {
        info!("Registering tools for toolsets: {:?}", self.config.toolsets);
        
        for toolset in &self.config.toolsets {
            match toolset.as_str() {
                "all" => {
                    self.register_all_toolsets(server)?;
                    break;
                }
                "default" => {
                    self.register_default_toolset(server)?;
                }
                "pipelines" => {
                    self.register_pipeline_tools(server)?;
                }
                "connectors" => {
                    self.register_connector_tools(server)?;
                }
                // Add more toolsets as needed
                _ => {
                    debug!("Unknown toolset: {}", toolset);
                }
            }
        }
        
        Ok(())
    }
    
    fn register_all_toolsets(&self, server: &mut McpServer) -> Result<()> {
        self.register_default_toolset(server)?;
        self.register_pipeline_tools(server)?;
        self.register_connector_tools(server)?;
        // Add all other toolsets
        Ok(())
    }
    
    fn register_default_toolset(&self, server: &mut McpServer) -> Result<()> {
        info!("Registering default toolset");
        
        // Register a subset of tools from various services for the default toolset
        self.register_pipeline_tools(server)?;
        self.register_connector_tools(server)?;
        
        Ok(())
    }
    
    fn register_pipeline_tools(&self, server: &mut McpServer) -> Result<()> {
        info!("Registering pipeline tools");
        
        let pipeline_tools = PipelineTools::new(&self.config);
        
        // Register pipeline tools
        let (get_pipeline_tool, get_pipeline_handler) = pipeline_tools.get_pipeline_tool();
        server.add_tool(get_pipeline_tool, Arc::new(get_pipeline_handler));
        
        let (list_pipelines_tool, list_pipelines_handler) = pipeline_tools.list_pipelines_tool();
        server.add_tool(list_pipelines_tool, Arc::new(list_pipelines_handler));
        
        // Add more pipeline tools as needed
        
        Ok(())
    }
    
    fn register_connector_tools(&self, server: &mut McpServer) -> Result<()> {
        info!("Registering connector tools");
        
        let connector_tools = ConnectorTools::new(&self.config);
        
        // Register connector tools
        let (list_connectors_tool, list_connectors_handler) = connector_tools.list_connectors_tool();
        server.add_tool(list_connectors_tool, Arc::new(list_connectors_handler));
        
        // Add more connector tools as needed
        
        Ok(())
    }
}