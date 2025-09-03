use std::collections::HashMap;
use crate::types::HarnessError;

/// A tool handler function type
pub type ToolHandler = Box<dyn Fn() -> Result<String, HarnessError> + Send + Sync>;

/// Represents a single tool in a toolset
#[derive(Clone)]
pub struct Tool {
    pub name: String,
    pub description: String,
    // TODO: Add MCP tool schema and handler
}

/// Represents a group of related tools
pub struct Toolset {
    pub name: String,
    pub description: String,
    pub enabled: bool,
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

    /// Get all active tools based on toolset state
    pub fn get_active_tools(&self) -> Vec<&Tool> {
        if !self.enabled {
            return Vec::new();
        }

        let mut tools = self.read_tools.iter().collect::<Vec<_>>();
        if !self.read_only {
            tools.extend(self.write_tools.iter());
        }
        tools
    }

    /// Get all available tools regardless of enabled state
    pub fn get_available_tools(&self) -> Vec<&Tool> {
        let mut tools = self.read_tools.iter().collect::<Vec<_>>();
        if !self.read_only {
            tools.extend(self.write_tools.iter());
        }
        tools
    }

    /// Set the toolset to read-only mode
    pub fn set_read_only(&mut self) {
        self.read_only = true;
    }

    /// Add write tools to the toolset
    pub fn add_write_tools(&mut self, tools: Vec<Tool>) {
        if !self.read_only {
            self.write_tools.extend(tools);
        }
    }

    /// Add read tools to the toolset
    pub fn add_read_tools(&mut self, tools: Vec<Tool>) {
        self.read_tools.extend(tools);
    }
}

/// Manages multiple toolsets
pub struct ToolsetGroup {
    pub toolsets: HashMap<String, Toolset>,
    everything_on: bool,
    read_only: bool,
}

impl ToolsetGroup {
    /// Create a new toolset group
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
        self.toolsets.insert(toolset.name.clone(), toolset);
    }

    /// Check if a toolset is enabled
    pub fn is_enabled(&self, name: &str) -> bool {
        if self.everything_on {
            return true;
        }

        self.toolsets
            .get(name)
            .map(|toolset| toolset.enabled)
            .unwrap_or(false)
    }

    /// Enable multiple toolsets by name
    pub fn enable_toolsets(&mut self, names: &[String]) -> Result<(), HarnessError> {
        if names.is_empty() {
            return self.enable_toolset("default");
        }

        for name in names {
            if name == "all" {
                self.everything_on = true;
                break;
            }
            self.enable_toolset(name)?;
        }

        if self.everything_on {
            for name in self.toolsets.keys().cloned().collect::<Vec<_>>() {
                self.enable_toolset(&name)?;
            }
        }

        Ok(())
    }

    /// Enable a specific toolset by name
    pub fn enable_toolset(&mut self, name: &str) -> Result<(), HarnessError> {
        match self.toolsets.get_mut(name) {
            Some(toolset) => {
                toolset.enabled = true;
                Ok(())
            }
            None => Err(HarnessError::Validation(format!(
                "Toolset '{}' does not exist",
                name
            ))),
        }
    }

    /// Register all enabled toolsets with a server
    pub fn register_tools(&self, _server: &mut dyn std::any::Any) {
        // TODO: Implement tool registration with MCP server
        for toolset in self.toolsets.values() {
            if toolset.enabled {
                // Register tools with the server
                for _tool in toolset.get_active_tools() {
                    // TODO: Register each tool with the MCP server
                }
            }
        }
    }
}