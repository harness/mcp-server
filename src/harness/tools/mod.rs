//! Tool implementations for the Harness MCP server

use crate::types::{Config, Result};
use async_trait::async_trait;
use serde_json::Value;

/// Trait for MCP tools
#[async_trait]
pub trait McpTool: Send + Sync {
    /// Get the tool name
    fn name(&self) -> &str;
    
    /// Get the tool description
    fn description(&self) -> &str;
    
    /// Get the tool input schema
    fn input_schema(&self) -> Value;
    
    /// Execute the tool with given arguments
    async fn execute(&self, args: Value) -> Result<Value>;
}

/// Tool registry for managing available tools
pub struct ToolRegistry {
    tools: Vec<Box<dyn McpTool>>,
}

impl ToolRegistry {
    pub fn new() -> Self {
        Self { tools: Vec::new() }
    }
    
    /// Register a new tool
    pub fn register_tool(&mut self, tool: Box<dyn McpTool>) {
        self.tools.push(tool);
    }
    
    /// Get all registered tools
    pub fn tools(&self) -> &[Box<dyn McpTool>] {
        &self.tools
    }
    
    /// Find a tool by name
    pub fn find_tool(&self, name: &str) -> Option<&dyn McpTool> {
        self.tools.iter()
            .find(|tool| tool.name() == name)
            .map(|tool| tool.as_ref())
    }
}

impl Default for ToolRegistry {
    fn default() -> Self {
        Self::new()
    }
}