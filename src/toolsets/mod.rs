use anyhow::Result;
use serde_json::{Map, Value};
use std::collections::HashMap;

use crate::config::Config;

pub struct ToolsetGroup {
    config: Config,
    tools: HashMap<String, Box<dyn Tool + Send + Sync>>,
}

#[async_trait::async_trait]
pub trait Tool {
    async fn execute(&self, arguments: Map<String, Value>) -> Result<String>;
    fn name(&self) -> &str;
    fn description(&self) -> &str;
    fn input_schema(&self) -> Value;
}

impl ToolsetGroup {
    pub async fn new(config: &Config) -> Result<Self> {
        let mut group = Self {
            config: config.clone(),
            tools: HashMap::new(),
        };

        // Initialize toolsets based on configuration
        group.initialize_toolsets().await?;

        Ok(group)
    }

    async fn initialize_toolsets(&mut self) -> Result<()> {
        // TODO: Initialize toolsets based on configuration
        // For now, we'll add a simple ping tool as an example
        
        self.add_tool(Box::new(PingTool));
        
        Ok(())
    }

    pub fn add_tool(&mut self, tool: Box<dyn Tool + Send + Sync>) {
        self.tools.insert(tool.name().to_string(), tool);
    }

    pub async fn list_tools(&self) -> Result<Vec<Value>> {
        let mut tools = Vec::new();
        
        for tool in self.tools.values() {
            tools.push(serde_json::json!({
                "name": tool.name(),
                "description": tool.description(),
                "inputSchema": tool.input_schema()
            }));
        }
        
        Ok(tools)
    }

    pub async fn call_tool(&self, name: &str, arguments: Map<String, Value>) -> Result<String> {
        match self.tools.get(name) {
            Some(tool) => tool.execute(arguments).await,
            None => anyhow::bail!("Tool '{}' not found", name),
        }
    }
}

// Example tool implementation
struct PingTool;

#[async_trait::async_trait]
impl Tool for PingTool {
    async fn execute(&self, _arguments: Map<String, Value>) -> Result<String> {
        Ok("pong".to_string())
    }

    fn name(&self) -> &str {
        "ping"
    }

    fn description(&self) -> &str {
        "A simple ping tool that returns 'pong'"
    }

    fn input_schema(&self) -> Value {
        serde_json::json!({
            "type": "object",
            "properties": {},
            "required": []
        })
    }
}