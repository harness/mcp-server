use anyhow::Result;
use async_trait::async_trait;
use std::collections::HashMap;

/// Tool group tracker keeps track of which tools belong to which groups
/// This eliminates the need for hardcoded mappings by learning the relationships
/// when tools are registered.
#[async_trait]
pub trait ToolGroupTracker: Send + Sync {
    /// Returns the group name for a given tool name
    fn get_group_for_tool(&self, tool_name: &str) -> Option<String>;
    
    /// Returns a copy of all tool-to-group mappings
    fn get_all_tool_mappings(&self) -> HashMap<String, String>;
    
    /// Registers a tool group and captures its tool mappings
    async fn register_tool_group(&mut self, toolset: &Toolset) -> Result<()>;
    
    /// Removes all registered mappings (useful for testing)
    fn clear(&mut self);
    
    /// Returns all registered group names
    fn get_registered_groups(&self) -> Vec<String>;
}

/// Simple implementation of ToolGroupTracker
pub struct SimpleToolGroupTracker {
    /// Maps tool names to their containing group names
    tool_to_group_map: HashMap<String, String>,
    /// Tracks all registered group names
    group_names: std::collections::HashSet<String>,
}

impl SimpleToolGroupTracker {
    pub fn new() -> Self {
        Self {
            tool_to_group_map: HashMap::new(),
            group_names: std::collections::HashSet::new(),
        }
    }
}

impl Default for SimpleToolGroupTracker {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl ToolGroupTracker for SimpleToolGroupTracker {
    fn get_group_for_tool(&self, tool_name: &str) -> Option<String> {
        self.tool_to_group_map.get(tool_name).cloned()
    }
    
    fn get_all_tool_mappings(&self) -> HashMap<String, String> {
        self.tool_to_group_map.clone()
    }
    
    async fn register_tool_group(&mut self, toolset: &Toolset) -> Result<()> {
        // Track the group name
        self.group_names.insert(toolset.name().to_string());
        
        // Extract tool names from all available tools (both read and write)
        let all_tools = toolset.get_available_tools();
        
        for tool in all_tools {
            let tool_name = tool.name();
            if !tool_name.is_empty() {
                self.tool_to_group_map.insert(tool_name.to_string(), toolset.name().to_string());
            }
        }
        
        Ok(())
    }
    
    fn clear(&mut self) {
        self.tool_to_group_map.clear();
        self.group_names.clear();
    }
    
    fn get_registered_groups(&self) -> Vec<String> {
        self.group_names.iter().cloned().collect()
    }
}

// Forward declaration for Toolset - this will be defined in the main toolsets module
use super::{Toolset, Tool};