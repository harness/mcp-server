use crate::config::Config;
use crate::error::Result;
use crate::mcp::{Tool, ToolCall, ToolResult};
use crate::tools::{ToolHandler, create_text_result, create_error_result, get_required_param};
use crate::tools::common::{Scope, create_scope_properties};
use crate::utils::create_json_schema_object;
use async_trait::async_trait;
use serde_json::{json, Value};
use std::collections::HashMap;
use tracing::{debug, error};

pub struct PipelineTools {
    config: Config,
}

impl PipelineTools {
    pub fn new(config: &Config) -> Self {
        Self {
            config: config.clone(),
        }
    }
    
    pub fn get_pipeline_tool(&self) -> (Tool, GetPipelineHandler) {
        let mut properties = HashMap::new();
        properties.insert(
            "pipeline_id".to_string(),
            json!({
                "type": "string",
                "description": "The ID of the pipeline"
            })
        );
        properties.extend(create_scope_properties());
        
        let tool = Tool {
            name: "get_pipeline".to_string(),
            description: Some("Get details of a specific pipeline in a Harness repository. Use list_pipelines (if available) first to find the correct pipeline_id if you're unsure of the exact ID.".to_string()),
            input_schema: create_json_schema_object(properties, vec!["pipeline_id".to_string()]),
        };
        
        let handler = GetPipelineHandler {
            config: self.config.clone(),
        };
        
        (tool, handler)
    }
    
    pub fn list_pipelines_tool(&self) -> (Tool, ListPipelinesHandler) {
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
                "description": "Search term to filter pipelines"
            })
        );
        properties.extend(create_scope_properties());
        
        let tool = Tool {
            name: "list_pipelines".to_string(),
            description: Some("List pipelines in a repository with optional filtering and pagination.".to_string()),
            input_schema: create_json_schema_object(properties, vec![]),
        };
        
        let handler = ListPipelinesHandler {
            config: self.config.clone(),
        };
        
        (tool, handler)
    }
}

pub struct GetPipelineHandler {
    config: Config,
}

#[async_trait]
impl ToolHandler for GetPipelineHandler {
    async fn handle(&self, call: ToolCall, _config: &Config) -> Result<ToolResult> {
        debug!("Handling get_pipeline call: {:?}", call);
        
        let pipeline_id: String = get_required_param(&call.arguments, "pipeline_id")?;
        let scope = Scope::from_config_and_params(&self.config, &call.arguments)?;
        
        // TODO: Implement actual API call to Harness
        // For now, return a mock response
        let mock_response = json!({
            "pipeline": {
                "identifier": pipeline_id,
                "name": format!("Pipeline {}", pipeline_id),
                "description": "Mock pipeline description",
                "tags": {},
                "version": 1
            }
        });
        
        Ok(create_text_result(serde_json::to_string_pretty(&mock_response)?))
    }
}

pub struct ListPipelinesHandler {
    config: Config,
}

#[async_trait]
impl ToolHandler for ListPipelinesHandler {
    async fn handle(&self, call: ToolCall, _config: &Config) -> Result<ToolResult> {
        debug!("Handling list_pipelines call: {:?}", call);
        
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
        
        // TODO: Implement actual API call to Harness
        // For now, return a mock response
        let mock_response = json!({
            "content": [
                {
                    "identifier": "pipeline1",
                    "name": "Sample Pipeline 1",
                    "description": "First sample pipeline"
                },
                {
                    "identifier": "pipeline2", 
                    "name": "Sample Pipeline 2",
                    "description": "Second sample pipeline"
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