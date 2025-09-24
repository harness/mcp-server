//! Tool registry for managing and organizing tools

use crate::toolset::Toolset;
use std::collections::HashMap;

/// Tool registry for managing toolsets and tools
pub struct ToolRegistry {
    toolsets: HashMap<String, Toolset>,
}

impl ToolRegistry {
    /// Create a new tool registry
    pub fn new() -> Self {
        Self {
            toolsets: HashMap::new(),
        }
    }

    /// Register a toolset
    pub fn register_toolset(&mut self, toolset: Toolset) {
        self.toolsets.insert(toolset.name().to_string(), toolset);
    }

    /// Get a toolset by name
    pub fn get_toolset(&self, name: &str) -> Option<&Toolset> {
        self.toolsets.get(name)
    }

    /// List all toolset names
    pub fn list_toolsets(&self) -> Vec<String> {
        self.toolsets.keys().cloned().collect()
    }

    /// Check if a toolset is registered
    pub fn has_toolset(&self, name: &str) -> bool {
        self.toolsets.contains_key(name)
    }
}

impl Default for ToolRegistry {
    fn default() -> Self {
        Self::new()
    }
}
