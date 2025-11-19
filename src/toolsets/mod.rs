use anyhow::Result;
use std::collections::HashMap;

pub mod traits;
pub use traits::*;

/// A single tool in a toolset
#[derive(Debug, Clone)]
pub struct Tool {
    name: String,
    description: String,
}

impl Tool {
    pub fn new(name: String, description: String) -> Self {
        Self { name, description }
    }
    
    pub fn name(&self) -> &str {
        &self.name
    }
    
    pub fn description(&self) -> &str {
        &self.description
    }
}

/// A toolset represents a group of related tools
#[derive(Debug, Clone)]
pub struct Toolset {
    name: String,
    description: String,
    enabled: bool,
    read_only: bool,
    write_tools: Vec<Tool>,
    read_tools: Vec<Tool>,
}

impl Toolset {
    pub fn new(name: String, description: String) -> Self {
        Self {
            name,
            description,
            enabled: false,
            read_only: false,
            write_tools: Vec::new(),
            read_tools: Vec::new(),
        }
    }
    
    pub fn name(&self) -> &str {
        &self.name
    }
    
    pub fn description(&self) -> &str {
        &self.description
    }
    
    pub fn is_enabled(&self) -> bool {
        self.enabled
    }
    
    pub fn set_enabled(&mut self, enabled: bool) {
        self.enabled = enabled;
    }
    
    pub fn set_read_only(&mut self) {
        self.read_only = true;
    }
    
    pub fn add_write_tools(&mut self, tools: Vec<Tool>) {
        if !self.read_only {
            self.write_tools.extend(tools);
        }
    }
    
    pub fn add_read_tools(&mut self, tools: Vec<Tool>) {
        self.read_tools.extend(tools);
    }
    
    /// Get all active tools based on toolset state
    pub fn get_active_tools(&self) -> Vec<&Tool> {
        if self.enabled {
            if self.read_only {
                self.read_tools.iter().collect()
            } else {
                let mut tools: Vec<&Tool> = self.read_tools.iter().collect();
                tools.extend(self.write_tools.iter());
                tools
            }
        } else {
            Vec::new()
        }
    }
    
    /// Get all available tools regardless of enabled state
    pub fn get_available_tools(&self) -> Vec<&Tool> {
        if self.read_only {
            self.read_tools.iter().collect()
        } else {
            let mut tools: Vec<&Tool> = self.read_tools.iter().collect();
            tools.extend(self.write_tools.iter());
            tools
        }
    }
}

/// ToolsetGroup manages multiple toolsets
#[derive(Clone)]
pub struct ToolsetGroup {
    toolsets: HashMap<String, Toolset>,
    everything_on: bool,
    read_only: bool,
}

impl ToolsetGroup {
    pub fn new(read_only: bool) -> Self {
        Self {
            toolsets: HashMap::new(),
            everything_on: false,
            read_only,
        }
    }
    
    /// Add a toolset to the group
    pub fn add_toolset(&mut self, mut toolset: Toolset) {
        if self.read_only {
            toolset.set_read_only();
        }
        self.toolsets.insert(toolset.name().to_string(), toolset);
    }
    
    /// Check if a toolset exists
    pub fn has_toolset(&self, name: &str) -> bool {
        self.toolsets.contains_key(name)
    }
    
    /// Check if a toolset is enabled
    pub fn is_enabled(&self, name: &str) -> bool {
        if self.everything_on {
            return true;
        }
        
        self.toolsets.get(name)
            .map(|toolset| toolset.is_enabled())
            .unwrap_or(false)
    }
    
    /// Enable multiple toolsets by name
    pub async fn enable_toolsets(&mut self, names: Vec<String>) -> Result<()> {
        if names.is_empty() {
            return self.enable_toolset("default".to_string()).await;
        }
        
        for name in names {
            if name == "all" {
                self.everything_on = true;
                break;
            }
            self.enable_toolset(name).await?;
        }
        
        if self.everything_on {
            let toolset_names: Vec<String> = self.toolsets.keys().cloned().collect();
            for name in toolset_names {
                self.enable_toolset(name).await?;
            }
        }
        
        Ok(())
    }
    
    /// Enable a specific toolset by name
    pub async fn enable_toolset(&mut self, name: String) -> Result<()> {
        if let Some(toolset) = self.toolsets.get_mut(&name) {
            if !toolset.is_enabled() {
                toolset.set_enabled(true);
                // Log each tool in this toolset
                for tool in toolset.get_available_tools() {
                    tracing::info!("Tool enabled: toolset={}, tool={}", name, tool.name());
                }
            }
            Ok(())
        } else {
            anyhow::bail!("Toolset {} does not exist", name)
        }
    }
}