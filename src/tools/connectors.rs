use crate::client::HttpClient;
use crate::error::Result;
use crate::mcp::{ToolHandler, Tool, CallToolRequest, CallToolResponse, ToolContent, ToolInputSchema};
use crate::types::{HarnessResponse, PagedResponse};
use crate::types::connectors::{ConnectorDetail, ConnectorCatalogueItem, ConnectorListRequestBody};
use async_trait::async_trait;
use std::collections::HashMap;

/// Tool for getting connector details
pub struct GetConnectorDetailsTool {
    client: HttpClient,
}

impl GetConnectorDetailsTool {
    pub fn new(client: HttpClient) -> Self {
        Self { client }
    }
}

#[async_trait]
impl ToolHandler for GetConnectorDetailsTool {
    async fn call(&self, request: CallToolRequest) -> Result<CallToolResponse> {
        let args = request.arguments.unwrap_or_default();
        
        // Extract required parameters
        let connector_id = args.get("connector_id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| crate::error::McpError::validation("connector_id is required"))?;
            
        let account_id = args.get("account_id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| crate::error::McpError::validation("account_id is required"))?;
            
        let org_id = args.get("org_id").and_then(|v| v.as_str());
        let project_id = args.get("project_id").and_then(|v| v.as_str());

        // Build the API path
        let mut path = format!("ng/api/connectors/{}", connector_id);
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
        let response: HarnessResponse<ConnectorDetail> = self.client.get(&path).await?;
        
        // Convert to JSON string for the response
        let json_response = serde_json::to_string_pretty(&response)?;
        
        Ok(CallToolResponse {
            content: vec![ToolContent::Text { text: json_response }],
            is_error: Some(false),
        })
    }

    fn definition(&self) -> Tool {
        Tool {
            name: "get_connector_details".to_string(),
            description: "Get details of a specific connector in Harness.".to_string(),
            input_schema: ToolInputSchema {
                schema_type: "object".to_string(),
                properties: Some({
                    let mut props = HashMap::new();
                    props.insert("connector_id".to_string(), serde_json::json!({
                        "type": "string",
                        "description": "The ID of the connector"
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
                required: Some(vec!["connector_id".to_string(), "account_id".to_string()]),
            },
        }
    }
}

/// Tool for listing connector catalogue
pub struct ListConnectorCatalogueTool {
    client: HttpClient,
}

impl ListConnectorCatalogueTool {
    pub fn new(client: HttpClient) -> Self {
        Self { client }
    }
}

#[async_trait]
impl ToolHandler for ListConnectorCatalogueTool {
    async fn call(&self, request: CallToolRequest) -> Result<CallToolResponse> {
        let args = request.arguments.unwrap_or_default();
        
        // Extract required parameters
        let account_id = args.get("account_id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| crate::error::McpError::validation("account_id is required"))?;

        // Build the API path
        let path = format!("ng/api/connectors/catalogue?accountIdentifier={}", account_id);

        // Make the API call
        let response: HarnessResponse<Vec<ConnectorCatalogueItem>> = self.client.get(&path).await?;
        
        // Convert to JSON string for the response
        let json_response = serde_json::to_string_pretty(&response)?;
        
        Ok(CallToolResponse {
            content: vec![ToolContent::Text { text: json_response }],
            is_error: Some(false),
        })
    }

    fn definition(&self) -> Tool {
        Tool {
            name: "list_connector_catalogue".to_string(),
            description: "List the Harness connector catalogue showing all available connector types.".to_string(),
            input_schema: ToolInputSchema {
                schema_type: "object".to_string(),
                properties: Some({
                    let mut props = HashMap::new();
                    props.insert("account_id".to_string(), serde_json::json!({
                        "type": "string",
                        "description": "The Harness account identifier"
                    }));
                    props
                }),
                required: Some(vec!["account_id".to_string()]),
            },
        }
    }
}

/// Tool for listing connectors with filtering
pub struct ListConnectorsTool {
    client: HttpClient,
}

impl ListConnectorsTool {
    pub fn new(client: HttpClient) -> Self {
        Self { client }
    }
}

#[async_trait]
impl ToolHandler for ListConnectorsTool {
    async fn call(&self, request: CallToolRequest) -> Result<CallToolResponse> {
        let args = request.arguments.unwrap_or_default();
        
        // Extract required parameters
        let account_id = args.get("account_id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| crate::error::McpError::validation("account_id is required"))?;
            
        let org_id = args.get("org_id").and_then(|v| v.as_str());
        let project_id = args.get("project_id").and_then(|v| v.as_str());
        let page = args.get("page").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
        let size = args.get("size").and_then(|v| v.as_i64()).unwrap_or(20) as i32;

        // Build request body for filtering
        let mut request_body = ConnectorListRequestBody::default();
        
        // Add optional filters
        if let Some(types) = args.get("types").and_then(|v| v.as_array()) {
            request_body.types = Some(
                types.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect()
            );
        }
        
        if let Some(categories) = args.get("categories").and_then(|v| v.as_array()) {
            request_body.categories = Some(
                categories.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect()
            );
        }

        // Build the API path
        let mut path = "ng/api/connectors/listV2".to_string();
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

        // Add query parameters to path
        path.push('?');
        path.push_str(&query_params
            .iter()
            .map(|(k, v)| format!("{}={}", k, v))
            .collect::<Vec<_>>()
            .join("&"));

        // Make the API call with POST body
        let response: HarnessResponse<PagedResponse<ConnectorDetail>> = 
            self.client.post(&path, &request_body).await?;
        
        // Convert to JSON string for the response
        let json_response = serde_json::to_string_pretty(&response)?;
        
        Ok(CallToolResponse {
            content: vec![ToolContent::Text { text: json_response }],
            is_error: Some(false),
        })
    }

    fn definition(&self) -> Tool {
        Tool {
            name: "list_connectors".to_string(),
            description: "List connectors with filtering options such as type, category, and connectivity status.".to_string(),
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
                    props.insert("types".to_string(), serde_json::json!({
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Filter by connector types (optional)"
                    }));
                    props.insert("categories".to_string(), serde_json::json!({
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Filter by connector categories (optional)"
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