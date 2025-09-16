use crate::client::HttpClient;
use crate::error::Result;
use crate::mcp::{ToolHandler, Tool, CallToolRequest, CallToolResponse, ToolContent, ToolInputSchema};
use crate::types::{HarnessResponse, Scope};
use crate::types::pipelines::{PipelineData, PipelineListOptions, ListOutput, PipelineListItem};
use async_trait::async_trait;
use std::collections::HashMap;

/// Tool for getting pipeline details
pub struct GetPipelineTool {
    client: HttpClient,
}

impl GetPipelineTool {
    pub fn new(client: HttpClient) -> Self {
        Self { client }
    }
}

#[async_trait]
impl ToolHandler for GetPipelineTool {
    async fn call(&self, request: CallToolRequest) -> Result<CallToolResponse> {
        let args = request.arguments.unwrap_or_default();
        
        // Extract required parameters
        let pipeline_id = args.get("pipeline_id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| crate::error::McpError::validation("pipeline_id is required"))?;
            
        let account_id = args.get("account_id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| crate::error::McpError::validation("account_id is required"))?;
            
        let org_id = args.get("org_id").and_then(|v| v.as_str());
        let project_id = args.get("project_id").and_then(|v| v.as_str());

        // Build the API path
        let mut path = format!("pipeline/api/pipelines/{}", pipeline_id);
        let mut query_params = vec![("accountIdentifier", account_id)];
        
        if let Some(org) = org_id {
            query_params.push(("orgIdentifier", org));
        }
        if let Some(project) = project_id {
            query_params.push(("projectIdentifier", project));
        }

        // Add query parameters to path
        if !query_params.is_empty() {
            path.push('?');
            path.push_str(&query_params
                .iter()
                .map(|(k, v)| format!("{}={}", k, v))
                .collect::<Vec<_>>()
                .join("&"));
        }

        // Make the API call
        let response: HarnessResponse<PipelineData> = self.client.get(&path).await?;
        
        // Convert to JSON string for the response
        let json_response = serde_json::to_string_pretty(&response)?;
        
        Ok(CallToolResponse {
            content: vec![ToolContent::Text { text: json_response }],
            is_error: Some(false),
        })
    }

    fn definition(&self) -> Tool {
        Tool {
            name: "get_pipeline".to_string(),
            description: "Get details of a specific pipeline in a Harness repository. Use list_pipelines first to find the correct pipeline_id if you're unsure of the exact ID.".to_string(),
            input_schema: ToolInputSchema {
                schema_type: "object".to_string(),
                properties: Some({
                    let mut props = HashMap::new();
                    props.insert("pipeline_id".to_string(), serde_json::json!({
                        "type": "string",
                        "description": "The ID of the pipeline"
                    }));
                    props.insert("account_id".to_string(), serde_json::json!({
                        "type": "string",
                        "description": "The Harness account identifier"
                    }));
                    props.insert("org_id".to_string(), serde_json::json!({
                        "type": "string",
                        "description": "The organization identifier (optional)"
                    }));
                    props.insert("project_id".to_string(), serde_json::json!({
                        "type": "string",
                        "description": "The project identifier (optional)"
                    }));
                    props
                }),
                required: Some(vec!["pipeline_id".to_string(), "account_id".to_string()]),
            },
        }
    }
}

/// Tool for listing pipelines
pub struct ListPipelinesTool {
    client: HttpClient,
}

impl ListPipelinesTool {
    pub fn new(client: HttpClient) -> Self {
        Self { client }
    }
}

#[async_trait]
impl ToolHandler for ListPipelinesTool {
    async fn call(&self, request: CallToolRequest) -> Result<CallToolResponse> {
        let args = request.arguments.unwrap_or_default();
        
        // Extract required parameters
        let account_id = args.get("account_id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| crate::error::McpError::validation("account_id is required"))?;
            
        let org_id = args.get("org_id").and_then(|v| v.as_str());
        let project_id = args.get("project_id").and_then(|v| v.as_str());
        let search_term = args.get("search_term").and_then(|v| v.as_str());
        let page = args.get("page").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
        let size = args.get("size").and_then(|v| v.as_i64()).unwrap_or(20) as i32;

        // Build the API path
        let mut path = "pipeline/api/pipelines/list".to_string();
        let mut query_params = vec![
            ("accountIdentifier", account_id),
            ("page", &page.to_string()),
            ("size", &size.to_string()),
        ];
        
        if let Some(org) = org_id {
            query_params.push(("orgIdentifier", org));
        }
        if let Some(project) = project_id {
            query_params.push(("projectIdentifier", project));
        }
        if let Some(search) = search_term {
            query_params.push(("searchTerm", search));
        }

        // Add query parameters to path
        path.push('?');
        path.push_str(&query_params
            .iter()
            .map(|(k, v)| format!("{}={}", k, v))
            .collect::<Vec<_>>()
            .join("&"));

        // Make the API call
        let response: ListOutput<PipelineListItem> = self.client.get(&path).await?;
        
        // Convert to JSON string for the response
        let json_response = serde_json::to_string_pretty(&response)?;
        
        Ok(CallToolResponse {
            content: vec![ToolContent::Text { text: json_response }],
            is_error: Some(false),
        })
    }

    fn definition(&self) -> Tool {
        Tool {
            name: "list_pipelines".to_string(),
            description: "List pipelines in a Harness repository with optional filtering and pagination.".to_string(),
            input_schema: ToolInputSchema {
                schema_type: "object".to_string(),
                properties: Some({
                    let mut props = HashMap::new();
                    props.insert("account_id".to_string(), serde_json::json!({
                        "type": "string",
                        "description": "The Harness account identifier"
                    }));
                    props.insert("org_id".to_string(), serde_json::json!({
                        "type": "string",
                        "description": "The organization identifier (optional)"
                    }));
                    props.insert("project_id".to_string(), serde_json::json!({
                        "type": "string",
                        "description": "The project identifier (optional)"
                    }));
                    props.insert("search_term".to_string(), serde_json::json!({
                        "type": "string",
                        "description": "Search term to filter pipelines (optional)"
                    }));
                    props.insert("page".to_string(), serde_json::json!({
                        "type": "integer",
                        "description": "Page number for pagination (default: 0)"
                    }));
                    props.insert("size".to_string(), serde_json::json!({
                        "type": "integer",
                        "description": "Page size for pagination (default: 20)"
                    }));
                    props
                }),
                required: Some(vec!["account_id".to_string()]),
            },
        }
    }
}