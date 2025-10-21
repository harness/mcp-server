use crate::config::Config;
use crate::error::Result;
use crate::mcp::{Tool, ToolCall, ToolResult};
use crate::tools::{ToolHandler, create_text_result, create_error_result};
use crate::tools::common::{Scope, create_scope_properties};
use crate::utils::create_json_schema_object;
use async_trait::async_trait;
use serde_json::{json, Value};
use std::collections::HashMap;
use tracing::{debug, error};

pub struct ConnectorTools {
    config: Config,
}

impl ConnectorTools {
    pub fn new(config: &Config) -> Self {
        Self {
            config: config.clone(),
        }
    }
    
    pub fn list_connectors_tool(&self) -> (Tool, ListConnectorsHandler) {
        let mut properties = HashMap::new();
        properties.insert(
            "page".to_string(),
            json!({
                "type": "integer",
                "description": "Page number (default: 0)",
                "minimum": 0
            })
        );
        properties.insert(
            "size".to_string(),
            json!({
                "type": "integer",
                "description": "Page size (default: 20)",
                "minimum": 1,
                "maximum": 100
            })
        );
        properties.insert(
            "search_term".to_string(),
            json!({
                "type": "string",
                "description": "Search term to filter connectors"
            })
        );
        properties.insert(
            "category".to_string(),
            json!({
                "type": "string",
                "description": "Connector category filter",
                "enum": ["CLOUD_PROVIDER", "ARTIFACT_REGISTRY", "SOURCE_REPO", "MONITORING", "SECRET_MANAGER"]
            })
        );
        properties.extend(create_scope_properties());
        
        let tool = Tool {
            name: "list_connectors".to_string(),
            description: Some("List connectors with filtering options including search term, category, and pagination.".to_string()),
            input_schema: create_json_schema_object(properties, vec![]),
        };
        
        let handler = ListConnectorsHandler {
            config: self.config.clone(),
        };
        
        (tool, handler)
    }
}

pub struct ListConnectorsHandler {
    config: Config,
}

#[async_trait]
impl ToolHandler for ListConnectorsHandler {
    async fn handle(&self, call: ToolCall, _config: &Config) -> Result<ToolResult> {
        debug!("Handling list_connectors call: {:?}", call);
        
        let scope = Scope::from_config_and_params(&self.config, &call.arguments)?;
        let page: i32 = call.arguments.get("page")
            .and_then(|v| v.as_i64())
            .unwrap_or(0) as i32;
        let size: i32 = call.arguments.get("size")
            .and_then(|v| v.as_i64())
            .unwrap_or(20) as i32;
        let search_term: Option<String> = call.arguments.get("search_term")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let category: Option<String> = call.arguments.get("category")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        
        // TODO: Implement actual API call to Harness
        // For now, return a mock response
        let mock_response = json!({
            "content": [
                {
                    "connector": {
                        "identifier": "aws_connector_1",
                        "name": "AWS Production",
                        "description": "AWS connector for production environment",
                        "type": "Aws",
                        "category": "CLOUD_PROVIDER"
                    }
                },
                {
                    "connector": {
                        "identifier": "docker_registry_1",
                        "name": "Docker Hub",
                        "description": "Docker Hub registry connector",
                        "type": "DockerRegistry",
                        "category": "ARTIFACT_REGISTRY"
                    }
                }
            ],
            "totalElements": 2,
            "totalPages": 1,
            "size": size,
            "number": page
        });
        
        Ok(create_text_result(serde_json::to_string_pretty(&mock_response)?))
    }
}