use super::*;
use crate::error::Result;
use async_trait::async_trait;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;

#[async_trait]
pub trait ToolHandler: Send + Sync {
    async fn execute(&self, arguments: HashMap<String, Value>) -> Result<CallToolResponse>;
}

pub struct ToolRegistry {
    tools: HashMap<String, (Tool, Arc<dyn ToolHandler>)>,
}

impl ToolRegistry {
    pub fn new() -> Self {
        Self {
            tools: HashMap::new(),
        }
    }
    
    pub fn register_tool<H>(&mut self, tool: Tool, handler: H)
    where
        H: ToolHandler + 'static,
    {
        let name = tool.name.clone();
        self.tools.insert(name, (tool, Arc::new(handler)));
    }
    
    pub fn list_tools(&self) -> Vec<Tool> {
        self.tools.values().map(|(tool, _)| tool.clone()).collect()
    }
    
    pub async fn call_tool(&self, name: &str, arguments: HashMap<String, Value>) -> Result<CallToolResponse> {
        if let Some((_, handler)) = self.tools.get(name) {
            handler.execute(arguments).await
        } else {
            Ok(CallToolResponse::error(format!("Tool not found: {}", name)))
        }
    }
    
    pub fn has_tool(&self, name: &str) -> bool {
        self.tools.contains_key(name)
    }
}

impl Default for ToolRegistry {
    fn default() -> Self {
        Self::new()
    }
}

// Helper for creating tool input schemas
pub struct ToolSchemaBuilder {
    properties: HashMap<String, Value>,
    required: Vec<String>,
}

impl ToolSchemaBuilder {
    pub fn new() -> Self {
        Self {
            properties: HashMap::new(),
            required: Vec::new(),
        }
    }
    
    pub fn add_string_property(mut self, name: &str, description: &str, required: bool) -> Self {
        let property = serde_json::json!({
            "type": "string",
            "description": description
        });
        self.properties.insert(name.to_string(), property);
        
        if required {
            self.required.push(name.to_string());
        }
        
        self
    }
    
    pub fn add_integer_property(mut self, name: &str, description: &str, required: bool, default: Option<i64>) -> Self {
        let mut property = serde_json::json!({
            "type": "integer",
            "description": description
        });
        
        if let Some(default_value) = default {
            property["default"] = serde_json::json!(default_value);
        }
        
        self.properties.insert(name.to_string(), property);
        
        if required {
            self.required.push(name.to_string());
        }
        
        self
    }
    
    pub fn add_boolean_property(mut self, name: &str, description: &str, required: bool, default: Option<bool>) -> Self {
        let mut property = serde_json::json!({
            "type": "boolean",
            "description": description
        });
        
        if let Some(default_value) = default {
            property["default"] = serde_json::json!(default_value);
        }
        
        self.properties.insert(name.to_string(), property);
        
        if required {
            self.required.push(name.to_string());
        }
        
        self
    }
    
    pub fn build(self) -> ToolInputSchema {
        ToolInputSchema {
            schema_type: "object".to_string(),
            properties: self.properties,
            required: self.required,
            additionalProperties: Some(false),
        }
    }
}

impl Default for ToolSchemaBuilder {
    fn default() -> Self {
        Self::new()
    }
}

// Helper functions for parameter extraction
pub fn get_required_string(arguments: &HashMap<String, Value>, key: &str) -> Result<String> {
    arguments
        .get(key)
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| crate::error::missing_parameter(key))
}

pub fn get_optional_string(arguments: &HashMap<String, Value>, key: &str) -> Option<String> {
    arguments
        .get(key)
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

pub fn get_required_i64(arguments: &HashMap<String, Value>, key: &str) -> Result<i64> {
    arguments
        .get(key)
        .and_then(|v| v.as_i64())
        .ok_or_else(|| crate::error::missing_parameter(key))
}

pub fn get_optional_i64(arguments: &HashMap<String, Value>, key: &str) -> Option<i64> {
    arguments.get(key).and_then(|v| v.as_i64())
}

pub fn get_optional_bool(arguments: &HashMap<String, Value>, key: &str) -> Option<bool> {
    arguments.get(key).and_then(|v| v.as_bool())
}