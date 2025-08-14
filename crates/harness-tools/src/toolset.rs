use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use serde_json::Value;

/// A tool definition
/// Represents an individual tool that can be executed
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tool {
    pub name: String,
    pub description: String,
    pub input_schema: Value,
}

/// Tool execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResult {
    pub success: bool,
    pub content: Option<Value>,
    pub error: Option<String>,
}

/// A collection of related tools
#[derive(Debug, Clone)]
pub struct Toolset {
    pub name: String,
    pub description: String,
    pub tools: Vec<Tool>,
}

/// A group of toolsets
#[derive(Debug, Clone)]
pub struct ToolsetGroup {
    pub toolsets: HashMap<String, Toolset>,
}

impl ToolsetGroup {
    /// Create a new empty toolset group
    pub fn new() -> Self {
        Self {
            toolsets: HashMap::new(),
        }
    }
    
    /// Add a toolset to the group
    pub fn add_toolset(&mut self, toolset: Toolset) {
        self.toolsets.insert(toolset.name.clone(), toolset);
    }
    
    /// Get a toolset by name
    pub fn get_toolset(&self, name: &str) -> Option<&Toolset> {
        self.toolsets.get(name)
    }
    
    /// List all tools across all toolsets
    pub fn list_all_tools(&self) -> Vec<&Tool> {
        self.toolsets
            .values()
            .flat_map(|toolset| &toolset.tools)
            .collect()
    }
}

impl Default for ToolsetGroup {
    fn default() -> Self {
        Self::new()
    }
}