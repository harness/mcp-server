//! Tools module for MCP server

pub mod pipelines;
pub mod connectors;
pub mod dashboards;
// Add other tool modules as needed

use crate::Result;

/// Tool trait that all MCP tools must implement
#[async_trait::async_trait]
pub trait Tool: Send + Sync {
    /// Get the tool name
    fn name(&self) -> &str;
    
    /// Get the tool description
    fn description(&self) -> &str;
    
    /// Execute the tool with given parameters
    async fn execute(&self, params: serde_json::Value) -> Result<serde_json::Value>;
}

/// Tool registry for managing available tools
pub struct ToolRegistry {
    tools: std::collections::HashMap<String, Box<dyn Tool>>,
}

impl ToolRegistry {
    /// Create a new tool registry
    pub fn new() -> Self {
        Self {
            tools: std::collections::HashMap::new(),
        }
    }
    
    /// Register a tool
    pub fn register(&mut self, tool: Box<dyn Tool>) {
        self.tools.insert(tool.name().to_string(), tool);
    }
    
    /// Get a tool by name
    pub fn get(&self, name: &str) -> Option<&dyn Tool> {
        self.tools.get(name).map(|t| t.as_ref())
    }
    
    /// List all available tools
    pub fn list(&self) -> Vec<&str> {
        self.tools.keys().map(|s| s.as_str()).collect()
    }
}

impl Default for ToolRegistry {
    fn default() -> Self {
        Self::new()
    }
}