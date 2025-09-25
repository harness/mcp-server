pub mod pipelines;
pub mod services;
pub mod connectors;

use crate::config::Config;
use crate::error::Result;
use serde_json::Value;

/// Trait for MCP tools
#[async_trait::async_trait]
pub trait Tool {
    fn name(&self) -> &str;
    fn description(&self) -> &str;
    async fn execute(&self, params: Value) -> Result<Value>;
}

/// Tool registry for managing available tools
pub struct ToolRegistry {
    tools: Vec<Box<dyn Tool + Send + Sync>>,
}

impl ToolRegistry {
    pub fn new() -> Self {
        Self {
            tools: Vec::new(),
        }
    }
    
    pub fn register_tool(&mut self, tool: Box<dyn Tool + Send + Sync>) {
        self.tools.push(tool);
    }
    
    pub fn get_tool(&self, name: &str) -> Option<&(dyn Tool + Send + Sync)> {
        self.tools.iter().find(|tool| tool.name() == name).map(|t| t.as_ref())
    }
    
    pub fn list_tools(&self) -> Vec<&str> {
        self.tools.iter().map(|tool| tool.name()).collect()
    }
}

/// Initialize tools based on configuration
pub fn init_tools(config: &Config) -> Result<ToolRegistry> {
    let mut registry = ToolRegistry::new();
    
    // Register tools based on enabled toolsets
    for toolset in &config.toolsets {
        match toolset.as_str() {
            "all" | "default" => {
                // Pipeline tools
                registry.register_tool(Box::new(pipelines::ListPipelinesTool::new(config)?));
                registry.register_tool(Box::new(pipelines::GetPipelineTool::new(config)?));
                
                // Service tools
                registry.register_tool(Box::new(services::GetServiceTool::new(config)?));
                
                // Connector tools
                registry.register_tool(Box::new(connectors::ListConnectorsTool::new(config)?));
            }
            "pipelines" => {
                registry.register_tool(Box::new(pipelines::ListPipelinesTool::new(config)?));
                registry.register_tool(Box::new(pipelines::GetPipelineTool::new(config)?));
            }
            "services" => {
                registry.register_tool(Box::new(services::GetServiceTool::new(config)?));
            }
            "connectors" => {
                registry.register_tool(Box::new(connectors::ListConnectorsTool::new(config)?));
            }
            _ => {
                tracing::warn!("Unknown toolset: {}", toolset);
            }
        }
    }
    
    tracing::info!("Initialized {} tools", registry.list_tools().len());
    
    Ok(registry)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::Config;
    use async_trait::async_trait;
    use serde_json::json;

    // Mock tool for testing
    struct MockTool {
        name: String,
        description: String,
    }

    impl MockTool {
        fn new(name: &str, description: &str) -> Self {
            Self {
                name: name.to_string(),
                description: description.to_string(),
            }
        }
    }

    #[async_trait]
    impl Tool for MockTool {
        fn name(&self) -> &str {
            &self.name
        }
        
        fn description(&self) -> &str {
            &self.description
        }
        
        async fn execute(&self, _params: Value) -> Result<Value> {
            Ok(json!({"tool": self.name, "executed": true}))
        }
    }

    #[test]
    fn test_tool_registry_new() {
        let registry = ToolRegistry::new();
        assert_eq!(registry.list_tools().len(), 0);
    }

    #[test]
    fn test_tool_registry_register_tool() {
        let mut registry = ToolRegistry::new();
        let tool = MockTool::new("test_tool", "A test tool");
        
        registry.register_tool(Box::new(tool));
        assert_eq!(registry.list_tools().len(), 1);
        assert_eq!(registry.list_tools()[0], "test_tool");
    }

    #[test]
    fn test_tool_registry_get_tool() {
        let mut registry = ToolRegistry::new();
        let tool = MockTool::new("test_tool", "A test tool");
        
        registry.register_tool(Box::new(tool));
        
        let retrieved_tool = registry.get_tool("test_tool");
        assert!(retrieved_tool.is_some());
        assert_eq!(retrieved_tool.unwrap().name(), "test_tool");
        assert_eq!(retrieved_tool.unwrap().description(), "A test tool");
    }

    #[test]
    fn test_tool_registry_get_nonexistent_tool() {
        let registry = ToolRegistry::new();
        let retrieved_tool = registry.get_tool("nonexistent");
        assert!(retrieved_tool.is_none());
    }

    #[test]
    fn test_tool_registry_multiple_tools() {
        let mut registry = ToolRegistry::new();
        
        registry.register_tool(Box::new(MockTool::new("tool1", "First tool")));
        registry.register_tool(Box::new(MockTool::new("tool2", "Second tool")));
        registry.register_tool(Box::new(MockTool::new("tool3", "Third tool")));
        
        let tools = registry.list_tools();
        assert_eq!(tools.len(), 3);
        assert!(tools.contains(&"tool1"));
        assert!(tools.contains(&"tool2"));
        assert!(tools.contains(&"tool3"));
    }

    #[tokio::test]
    async fn test_mock_tool_execute() {
        let tool = MockTool::new("test_tool", "A test tool");
        let params = json!({"test": "value"});
        
        let result = tool.execute(params).await;
        assert!(result.is_ok());
        
        let response = result.unwrap();
        assert_eq!(response["tool"], "test_tool");
        assert_eq!(response["executed"], true);
    }

    #[test]
    fn test_init_tools_default_toolset() {
        let config = Config {
            toolsets: vec!["default".to_string()],
            base_url: "https://test.harness.io".to_string(),
            account_id: "test_account".to_string(),
            api_key: "test_key".to_string(),
            ..Default::default()
        };
        
        let result = init_tools(&config);
        assert!(result.is_ok());
        
        let registry = result.unwrap();
        let tools = registry.list_tools();
        
        // Should have pipeline, service, and connector tools
        assert!(tools.len() > 0);
        assert!(tools.contains(&"list_pipelines"));
        assert!(tools.contains(&"get_pipeline"));
        assert!(tools.contains(&"get_service"));
        assert!(tools.contains(&"list_connectors"));
    }

    #[test]
    fn test_init_tools_pipelines_toolset() {
        let config = Config {
            toolsets: vec!["pipelines".to_string()],
            base_url: "https://test.harness.io".to_string(),
            account_id: "test_account".to_string(),
            api_key: "test_key".to_string(),
            ..Default::default()
        };
        
        let result = init_tools(&config);
        assert!(result.is_ok());
        
        let registry = result.unwrap();
        let tools = registry.list_tools();
        
        // Should have only pipeline tools
        assert!(tools.contains(&"list_pipelines"));
        assert!(tools.contains(&"get_pipeline"));
        assert!(!tools.contains(&"get_service"));
        assert!(!tools.contains(&"list_connectors"));
    }

    #[test]
    fn test_init_tools_services_toolset() {
        let config = Config {
            toolsets: vec!["services".to_string()],
            base_url: "https://test.harness.io".to_string(),
            account_id: "test_account".to_string(),
            api_key: "test_key".to_string(),
            ..Default::default()
        };
        
        let result = init_tools(&config);
        assert!(result.is_ok());
        
        let registry = result.unwrap();
        let tools = registry.list_tools();
        
        // Should have only service tools
        assert!(!tools.contains(&"list_pipelines"));
        assert!(!tools.contains(&"get_pipeline"));
        assert!(tools.contains(&"get_service"));
        assert!(!tools.contains(&"list_connectors"));
    }

    #[test]
    fn test_init_tools_connectors_toolset() {
        let config = Config {
            toolsets: vec!["connectors".to_string()],
            base_url: "https://test.harness.io".to_string(),
            account_id: "test_account".to_string(),
            api_key: "test_key".to_string(),
            ..Default::default()
        };
        
        let result = init_tools(&config);
        assert!(result.is_ok());
        
        let registry = result.unwrap();
        let tools = registry.list_tools();
        
        // Should have only connector tools
        assert!(!tools.contains(&"list_pipelines"));
        assert!(!tools.contains(&"get_pipeline"));
        assert!(!tools.contains(&"get_service"));
        assert!(tools.contains(&"list_connectors"));
    }

    #[test]
    fn test_init_tools_multiple_toolsets() {
        let config = Config {
            toolsets: vec!["pipelines".to_string(), "services".to_string()],
            base_url: "https://test.harness.io".to_string(),
            account_id: "test_account".to_string(),
            api_key: "test_key".to_string(),
            ..Default::default()
        };
        
        let result = init_tools(&config);
        assert!(result.is_ok());
        
        let registry = result.unwrap();
        let tools = registry.list_tools();
        
        // Should have pipeline and service tools
        assert!(tools.contains(&"list_pipelines"));
        assert!(tools.contains(&"get_pipeline"));
        assert!(tools.contains(&"get_service"));
        assert!(!tools.contains(&"list_connectors"));
    }

    #[test]
    fn test_init_tools_unknown_toolset() {
        let config = Config {
            toolsets: vec!["unknown_toolset".to_string()],
            base_url: "https://test.harness.io".to_string(),
            account_id: "test_account".to_string(),
            api_key: "test_key".to_string(),
            ..Default::default()
        };
        
        let result = init_tools(&config);
        assert!(result.is_ok());
        
        let registry = result.unwrap();
        let tools = registry.list_tools();
        
        // Should have no tools for unknown toolset
        assert_eq!(tools.len(), 0);
    }
}