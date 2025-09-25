//! Toolset management and organization

use harness_mcp_core::types::Tool;
use crate::tools::pipelines::*;
use crate::tools::connectors::*;
use std::collections::HashMap;

/// A collection of related tools
#[derive(Debug, Clone)]
pub struct Toolset {
    pub name: String,
    pub description: String,
    pub enabled: bool,
    pub read_only: bool,
    pub tools: Vec<Tool>,
}

impl Toolset {
    /// Create a new toolset
    pub fn new(name: String, description: String) -> Self {
        Self {
            name,
            description,
            enabled: false,
            read_only: false,
            tools: Vec::new(),
        }
    }
    
    /// Add a tool to the toolset
    pub fn add_tool(&mut self, tool: Tool) {
        self.tools.push(tool);
    }
    
    /// Enable the toolset
    pub fn enable(&mut self) {
        self.enabled = true;
    }
    
    /// Set read-only mode
    pub fn set_read_only(&mut self, read_only: bool) {
        self.read_only = read_only;
    }
    
    /// Get all tools in the toolset
    pub fn get_tools(&self) -> &[Tool] {
        &self.tools
    }
}

/// Manages multiple toolsets
#[derive(Debug)]
pub struct ToolsetRegistry {
    toolsets: HashMap<String, Toolset>,
    read_only: bool,
}

impl ToolsetRegistry {
    /// Create a new toolset registry
    pub fn new(read_only: bool) -> Self {
        Self {
            toolsets: HashMap::new(),
            read_only,
        }
    }
    
    /// Register a toolset
    pub fn register_toolset(&mut self, mut toolset: Toolset) {
        if self.read_only {
            toolset.set_read_only(true);
        }
        self.toolsets.insert(toolset.name.clone(), toolset);
    }
    
    /// Enable a toolset by name
    pub fn enable_toolset(&mut self, name: &str) -> Result<(), String> {
        match self.toolsets.get_mut(name) {
            Some(toolset) => {
                toolset.enable();
                Ok(())
            }
            None => Err(format!("Toolset '{}' not found", name)),
        }
    }
    
    /// Get all enabled toolsets
    pub fn get_enabled_toolsets(&self) -> Vec<&Toolset> {
        self.toolsets
            .values()
            .filter(|toolset| toolset.enabled)
            .collect()
    }
    
    /// Get all tools from enabled toolsets
    pub fn get_all_tools(&self) -> Vec<&Tool> {
        self.get_enabled_toolsets()
            .into_iter()
            .flat_map(|toolset| toolset.get_tools())
            .collect()
    }

    /// Create default toolsets
    pub fn create_default_toolsets(&mut self) {
        // Create pipelines toolset
        let mut pipelines_toolset = Toolset::new(
            "pipelines".to_string(),
            "Pipeline management tools".to_string(),
        );
        pipelines_toolset.add_tool(create_get_pipeline_tool());
        pipelines_toolset.add_tool(create_list_pipelines_tool());
        pipelines_toolset.add_tool(create_get_execution_tool());
        pipelines_toolset.add_tool(create_list_executions_tool());
        pipelines_toolset.add_tool(create_fetch_execution_url_tool());
        self.register_toolset(pipelines_toolset);

        // Create connectors toolset
        let mut connectors_toolset = Toolset::new(
            "connectors".to_string(),
            "Connector management tools".to_string(),
        );
        connectors_toolset.add_tool(create_list_connector_catalogue_tool());
        connectors_toolset.add_tool(create_get_connector_details_tool());
        connectors_toolset.add_tool(create_list_connectors_tool());
        self.register_toolset(connectors_toolset);

        // Create default toolset with essential tools
        let mut default_toolset = Toolset::new(
            "default".to_string(),
            "Default essential tools".to_string(),
        );
        default_toolset.add_tool(create_list_pipelines_tool());
        default_toolset.add_tool(create_get_pipeline_tool());
        default_toolset.add_tool(create_list_connectors_tool());
        default_toolset.add_tool(create_get_connector_details_tool());
        self.register_toolset(default_toolset);
    }
}