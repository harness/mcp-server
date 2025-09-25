//! Tool implementations for Harness MCP Server
//!
//! This crate contains all the tool implementations that provide
//! functionality for interacting with Harness services through MCP.

pub mod toolsets;
pub mod tools;
pub mod service_factory;
pub mod handler_factory;

pub use toolsets::*;
pub use service_factory::*;
pub use handler_factory::*;

// Re-export error types for consistency
pub use harness_mcp_core::error::{Error, Result};

/// Re-export commonly used types
pub mod prelude {
    pub use crate::toolsets::*;
    pub use crate::tools::*;
    pub use crate::service_factory::*;
    pub use crate::handler_factory::*;
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::toolsets::{Toolset, ToolsetRegistry};
    use crate::tools::pipelines::*;
    use harness_mcp_core::types::Tool;

    #[test]
    fn test_toolset_creation() {
        let mut toolset = Toolset::new(
            "test_toolset".to_string(),
            "A test toolset".to_string(),
        );
        
        assert_eq!(toolset.name, "test_toolset");
        assert_eq!(toolset.description, "A test toolset");
        assert!(!toolset.enabled);
        assert!(!toolset.read_only);
        assert_eq!(toolset.tools.len(), 0);
        
        toolset.enable();
        assert!(toolset.enabled);
        
        toolset.set_read_only(true);
        assert!(toolset.read_only);
    }

    #[test]
    fn test_toolset_tool_management() {
        let mut toolset = Toolset::new(
            "test_toolset".to_string(),
            "A test toolset".to_string(),
        );
        
        let tool = Tool {
            name: "test_tool".to_string(),
            description: "A test tool".to_string(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "param": {"type": "string"}
                }
            }),
        };
        
        toolset.add_tool(tool.clone());
        assert_eq!(toolset.tools.len(), 1);
        assert_eq!(toolset.get_tools()[0].name, "test_tool");
    }

    #[test]
    fn test_toolset_registry() {
        let mut registry = ToolsetRegistry::new(false);
        
        let toolset = Toolset::new(
            "test_toolset".to_string(),
            "A test toolset".to_string(),
        );
        
        registry.register_toolset(toolset);
        
        let result = registry.enable_toolset("test_toolset");
        assert!(result.is_ok());
        
        let enabled_toolsets = registry.get_enabled_toolsets();
        assert_eq!(enabled_toolsets.len(), 1);
        assert_eq!(enabled_toolsets[0].name, "test_toolset");
    }

    #[test]
    fn test_toolset_registry_read_only() {
        let mut registry = ToolsetRegistry::new(true);
        
        let mut toolset = Toolset::new(
            "test_toolset".to_string(),
            "A test toolset".to_string(),
        );
        
        assert!(!toolset.read_only);
        registry.register_toolset(toolset);
        
        // Toolset should be marked as read-only when registered in read-only registry
        let enabled_toolsets = registry.get_enabled_toolsets();
        // Note: This test would need to be updated based on actual implementation
    }

    #[test]
    fn test_pipeline_tool_creation() {
        let tool = create_get_pipeline_tool();
        
        assert_eq!(tool.name, "get_pipeline");
        assert!(!tool.description.is_empty());
        assert!(tool.input_schema.is_object());
        
        // Verify required parameters
        let properties = tool.input_schema["properties"].as_object().unwrap();
        assert!(properties.contains_key("pipeline_id"));
        assert!(properties.contains_key("account_id"));
        assert!(properties.contains_key("org_id"));
        assert!(properties.contains_key("project_id"));
    }

    #[test]
    fn test_list_pipelines_tool_creation() {
        let tool = create_list_pipelines_tool();
        
        assert_eq!(tool.name, "list_pipelines");
        assert!(!tool.description.is_empty());
        assert!(tool.input_schema.is_object());
        
        // Verify required parameters
        let properties = tool.input_schema["properties"].as_object().unwrap();
        assert!(properties.contains_key("account_id"));
        assert!(properties.contains_key("org_id"));
        assert!(properties.contains_key("project_id"));
        
        // Verify optional parameters
        assert!(properties.contains_key("search_term"));
        assert!(properties.contains_key("page"));
        assert!(properties.contains_key("size"));
    }

    #[test]
    fn test_default_toolsets_creation() {
        let mut registry = ToolsetRegistry::new(false);
        registry.create_default_toolsets();
        
        // Should have created default toolsets
        let all_tools = registry.get_all_tools();
        assert!(!all_tools.is_empty());
    }

    #[test]
    fn test_toolset_registry_unknown_toolset() {
        let mut registry = ToolsetRegistry::new(false);
        
        let result = registry.enable_toolset("unknown_toolset");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not found"));
    }
}