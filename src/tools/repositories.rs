use super::*;
use crate::client::HarnessClient;
use crate::mcp::{CallToolResponse, ToolContent, Tool, ToolHandler, ToolSchemaBuilder};
use async_trait::async_trait;
use serde_json::Value;
use std::collections::HashMap;

pub struct ListRepositoriesHandler {
    client: Arc<HarnessClient>,
    config: Config,
}

impl ListRepositoriesHandler {
    pub fn new(client: Arc<HarnessClient>, config: Config) -> Self {
        Self { client, config }
    }
    
    pub fn tool() -> Tool {
        Tool {
            name: "list_repositories".to_string(),
            description: "List repositories in an organization and project".to_string(),
            input_schema: ToolSchemaBuilder::new()
                .add_string_property("accountIdentifier", "Account identifier", false)
                .add_string_property("orgIdentifier", "Organization identifier", false)
                .add_string_property("projectIdentifier", "Project identifier", false)
                .build(),
        }
    }
}

#[async_trait]
impl ToolHandler for ListRepositoriesHandler {
    async fn execute(&self, arguments: HashMap<String, Value>) -> Result<CallToolResponse> {
        let scope = extract_scope_from_arguments(&arguments, &self.config)?;
        let query = scope.to_query_params();
        
        match self.client.get::<crate::client::harness::HarnessResponse<Vec<crate::client::harness::Repository>>>(
            "/code/api/v1/repos",
            Some(&query),
        ).await {
            Ok(response) => {
                let json = serde_json::to_string_pretty(&response)?;
                Ok(CallToolResponse::success(vec![ToolContent::text(json)]))
            }
            Err(e) => Ok(CallToolResponse::error(format!("Failed to list repositories: {}", e))),
        }
    }
}

pub struct GetRepositoryHandler {
    client: Arc<HarnessClient>,
    config: Config,
}

impl GetRepositoryHandler {
    pub fn new(client: Arc<HarnessClient>, config: Config) -> Self {
        Self { client, config }
    }
    
    pub fn tool() -> Tool {
        Tool {
            name: "get_repository".to_string(),
            description: "Get details of a specific repository".to_string(),
            input_schema: ToolSchemaBuilder::new()
                .add_string_property("accountIdentifier", "Account identifier", false)
                .add_string_property("orgIdentifier", "Organization identifier", false)
                .add_string_property("projectIdentifier", "Project identifier", false)
                .add_string_property("repository_id", "The ID of the repository", true)
                .build(),
        }
    }
}

#[async_trait]
impl ToolHandler for GetRepositoryHandler {
    async fn execute(&self, arguments: HashMap<String, Value>) -> Result<CallToolResponse> {
        let scope = extract_scope_from_arguments(&arguments, &self.config)?;
        let repository_id = crate::mcp::tool::get_required_string(&arguments, "repository_id")?;
        
        let mut query = scope.to_query_params();
        query.insert("repoIdentifier".to_string(), repository_id);
        
        match self.client.get::<crate::client::harness::HarnessResponse<crate::client::harness::Repository>>(
            "/code/api/v1/repos",
            Some(&query),
        ).await {
            Ok(response) => {
                let json = serde_json::to_string_pretty(&response)?;
                Ok(CallToolResponse::success(vec![ToolContent::text(json)]))
            }
            Err(e) => Ok(CallToolResponse::error(format!("Failed to get repository: {}", e))),
        }
    }
}