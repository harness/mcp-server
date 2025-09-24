use crate::config::Config;
use crate::error::Result;
use crate::mcp::{Tool, Content, CallToolResponse};
use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::Arc;

#[derive(Debug, Clone)]
pub struct ToolCall {
    pub name: String,
    pub arguments: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone)]
pub struct ToolResult {
    pub content: Vec<Content>,
    pub is_error: bool,
}

#[async_trait]
pub trait ToolHandler: Send + Sync {
    async fn execute(&self, call: ToolCall) -> Result<ToolResult>;
}

#[derive(Clone)]
pub struct ToolRegistry {
    tools: HashMap<String, Tool>,
    handlers: HashMap<String, Arc<dyn ToolHandler>>,
}

impl ToolRegistry {
    pub async fn new(config: &Config) -> Result<Self> {
        let mut registry = Self {
            tools: HashMap::new(),
            handlers: HashMap::new(),
        };

        // Register tools based on configuration
        registry.register_default_tools(config).await?;
        
        if config.toolsets.contains(&"all".to_string()) || config.toolsets.contains(&"pipelines".to_string()) {
            registry.register_pipeline_tools(config).await?;
        }

        // Add more toolsets as needed...

        Ok(registry)
    }

    pub fn get_tools(&self) -> Vec<&Tool> {
        self.tools.values().collect()
    }

    pub async fn execute_tool(&self, call: ToolCall) -> Result<ToolResult> {
        if let Some(handler) = self.handlers.get(&call.name) {
            handler.execute(call).await
        } else {
            Err(crate::error::McpError::ToolError(format!(
                "Tool '{}' not found",
                call.name
            )))
        }
    }

    fn register_tool(&mut self, tool: Tool, handler: Arc<dyn ToolHandler>) {
        let name = tool.name.clone();
        self.tools.insert(name.clone(), tool);
        self.handlers.insert(name, handler);
    }

    async fn register_default_tools(&mut self, _config: &Config) -> Result<()> {
        // Register a simple test tool for now
        let test_tool = Tool {
            name: "test".to_string(),
            description: "A simple test tool".to_string(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "message": {
                        "type": "string",
                        "description": "A test message"
                    }
                }
            }),
        };

        self.register_tool(test_tool, Arc::new(TestToolHandler));
        Ok(())
    }

    async fn register_pipeline_tools(&mut self, _config: &Config) -> Result<()> {
        // TODO: Implement pipeline tools registration
        Ok(())
    }
}

// Simple test tool handler
#[derive(Clone)]
struct TestToolHandler;

#[async_trait]
impl ToolHandler for TestToolHandler {
    async fn execute(&self, call: ToolCall) -> Result<ToolResult> {
        let message = call.arguments.get("message")
            .and_then(|v| v.as_str())
            .unwrap_or("Hello from Harness MCP Server!");

        Ok(ToolResult {
            content: vec![Content::Text {
                text: format!("Test tool executed with message: {}", message),
            }],
            is_error: false,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_tool_registry_creation() {
        let config = Config::default();
        let registry = ToolRegistry::new(&config).await;
        assert!(registry.is_ok());
        
        let registry = registry.unwrap();
        let tools = registry.get_tools();
        assert!(!tools.is_empty());
        
        // Should have at least the test tool
        let test_tool = tools.iter().find(|t| t.name == "test");
        assert!(test_tool.is_some());
    }

    #[tokio::test]
    async fn test_tool_execution() {
        let config = Config::default();
        let registry = ToolRegistry::new(&config).await.unwrap();
        
        let call = ToolCall {
            name: "test".to_string(),
            arguments: {
                let mut args = HashMap::new();
                args.insert("message".to_string(), serde_json::Value::String("Hello Test!".to_string()));
                args
            },
        };
        
        let result = registry.execute_tool(call).await;
        assert!(result.is_ok());
        
        let tool_result = result.unwrap();
        assert!(!tool_result.is_error);
        assert!(!tool_result.content.is_empty());
        
        if let Content::Text { text } = &tool_result.content[0] {
            assert!(text.contains("Hello Test!"));
        } else {
            panic!("Expected text content");
        }
    }

    #[tokio::test]
    async fn test_tool_execution_missing_tool() {
        let config = Config::default();
        let registry = ToolRegistry::new(&config).await.unwrap();
        
        let call = ToolCall {
            name: "nonexistent".to_string(),
            arguments: HashMap::new(),
        };
        
        let result = registry.execute_tool(call).await;
        assert!(result.is_err());
        
        if let Err(crate::error::McpError::ToolError(msg)) = result {
            assert!(msg.contains("Tool 'nonexistent' not found"));
        } else {
            panic!("Expected ToolError");
        }
    }

    #[tokio::test]
    async fn test_tool_execution_default_message() {
        let config = Config::default();
        let registry = ToolRegistry::new(&config).await.unwrap();
        
        let call = ToolCall {
            name: "test".to_string(),
            arguments: HashMap::new(), // No message provided
        };
        
        let result = registry.execute_tool(call).await;
        assert!(result.is_ok());
        
        let tool_result = result.unwrap();
        if let Content::Text { text } = &tool_result.content[0] {
            assert!(text.contains("Hello from Harness MCP Server!"));
        } else {
            panic!("Expected text content");
        }
    }

    #[test]
    fn test_tool_call_creation() {
        let mut args = HashMap::new();
        args.insert("key".to_string(), serde_json::Value::String("value".to_string()));
        
        let call = ToolCall {
            name: "test_tool".to_string(),
            arguments: args.clone(),
        };
        
        assert_eq!(call.name, "test_tool");
        assert_eq!(call.arguments, args);
    }

    #[test]
    fn test_tool_result_creation() {
        let content = vec![Content::Text {
            text: "Test result".to_string(),
        }];
        
        let result = ToolResult {
            content: content.clone(),
            is_error: false,
        };
        
        assert_eq!(result.content.len(), 1);
        assert!(!result.is_error);
        
        if let Content::Text { text } = &result.content[0] {
            assert_eq!(text, "Test result");
        }
    }
}