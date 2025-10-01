use super::*;
use crate::client::HarnessClient;
use crate::client::harness::PipelineService;
use crate::mcp::{CallToolResponse, ToolContent, Tool, ToolHandler, ToolSchemaBuilder};
use async_trait::async_trait;
use serde_json::Value;
use std::collections::HashMap;

pub struct ListPipelinesHandler {
    service: Arc<PipelineService>,
    config: Config,
}

impl ListPipelinesHandler {
    pub fn new(client: Arc<HarnessClient>, config: Config) -> Self {
        Self {
            service: Arc::new(PipelineService::new((*client).clone())),
            config,
        }
    }
    
    pub fn tool() -> Tool {
        Tool {
            name: "list_pipelines".to_string(),
            description: "List pipelines in an organization and project".to_string(),
            input_schema: ToolSchemaBuilder::new()
                .add_string_property("accountIdentifier", "Account identifier", false)
                .add_string_property("orgIdentifier", "Organization identifier", false)
                .add_string_property("projectIdentifier", "Project identifier", false)
                .add_integer_property("page", "Page number for pagination", false, Some(0))
                .add_integer_property("limit", "Number of items per page", false, Some(50))
                .build(),
        }
    }
}

#[async_trait]
impl ToolHandler for ListPipelinesHandler {
    async fn execute(&self, arguments: HashMap<String, Value>) -> Result<CallToolResponse> {
        let scope = extract_scope_from_arguments(&arguments, &self.config)?;
        
        let page = crate::mcp::tool::get_optional_i64(&arguments, "page");
        let limit = crate::mcp::tool::get_optional_i64(&arguments, "limit");
        
        match self.service.list_pipelines(&scope, page, limit).await {
            Ok(response) => {
                let json = serde_json::to_string_pretty(&response)?;
                Ok(CallToolResponse::success(vec![ToolContent::text(json)]))
            }
            Err(e) => Ok(CallToolResponse::error(format!("Failed to list pipelines: {}", e))),
        }
    }
}

pub struct GetPipelineHandler {
    service: Arc<PipelineService>,
    config: Config,
}

impl GetPipelineHandler {
    pub fn new(client: Arc<HarnessClient>, config: Config) -> Self {
        Self {
            service: Arc::new(PipelineService::new((*client).clone())),
            config,
        }
    }
    
    pub fn tool() -> Tool {
        Tool {
            name: "get_pipeline".to_string(),
            description: "Get details of a specific pipeline in a Harness repository. Use list_pipelines first to find the correct pipeline_id if you're unsure of the exact ID.".to_string(),
            input_schema: ToolSchemaBuilder::new()
                .add_string_property("accountIdentifier", "Account identifier", false)
                .add_string_property("orgIdentifier", "Organization identifier", false)
                .add_string_property("projectIdentifier", "Project identifier", false)
                .add_string_property("pipeline_id", "The ID of the pipeline", true)
                .build(),
        }
    }
}

#[async_trait]
impl ToolHandler for GetPipelineHandler {
    async fn execute(&self, arguments: HashMap<String, Value>) -> Result<CallToolResponse> {
        let scope = extract_scope_from_arguments(&arguments, &self.config)?;
        let pipeline_id = crate::mcp::tool::get_required_string(&arguments, "pipeline_id")?;
        
        match self.service.get_pipeline(&scope, &pipeline_id).await {
            Ok(response) => {
                let json = serde_json::to_string_pretty(&response)?;
                Ok(CallToolResponse::success(vec![ToolContent::text(json)]))
            }
            Err(e) => Ok(CallToolResponse::error(format!("Failed to get pipeline: {}", e))),
        }
    }
}