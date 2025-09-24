//! Toolset definition and management

use harness_mcp_core::types::Tool;

/// A collection of related tools
pub struct Toolset {
    name: String,
    description: String,
    tools: Vec<Tool>,
    enabled: bool,
}

impl Toolset {
    /// Create a new toolset
    pub fn new(name: impl Into<String>, description: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            description: description.into(),
            tools: Vec::new(),
            enabled: false,
        }
    }

    /// Get the toolset name
    pub fn name(&self) -> &str {
        &self.name
    }

    /// Get the toolset description
    pub fn description(&self) -> &str {
        &self.description
    }

    /// Add a tool to the toolset
    pub fn add_tool(mut self, tool: Tool) -> Self {
        self.tools.push(tool);
        self
    }

    /// Get all tools in the toolset
    pub fn tools(&self) -> &[Tool] {
        &self.tools
    }

    /// Enable the toolset
    pub fn enable(&mut self) {
        self.enabled = true;
    }

    /// Disable the toolset
    pub fn disable(&mut self) {
        self.enabled = false;
    }

    /// Check if the toolset is enabled
    pub fn is_enabled(&self) -> bool {
        self.enabled
    }

    /// Get the number of tools in the toolset
    pub fn tool_count(&self) -> usize {
        self.tools.len()
    }
}
