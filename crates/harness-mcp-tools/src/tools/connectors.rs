//! Connector tool implementations

use harness_mcp_client::services::ConnectorService;
use harness_mcp_client::dto::{Scope, PaginationOptions};
use harness_mcp_client::services::{ConnectorListOptions};
use harness_mcp_core::types::{Tool, ToolCallRequest, ToolCallResult, ToolResultContent};
use harness_mcp_core::error::Result;
use serde_json::json;

/// Create the list_connector_catalogue tool
pub fn create_list_connector_catalogue_tool() -> Tool {
    Tool {
        name: "list_connector_catalogue".to_string(),
        description: "List the Harness connector catalogue.".to_string(),
        input_schema: json!({
            "type": "object",
            "properties": {
                "account_id": {
                    "type": "string",
                    "description": "Account ID"
                },
                "org_id": {
                    "type": "string",
                    "description": "Organization ID"
                },
                "project_id": {
                    "type": "string",
                    "description": "Project ID"
                }
            },
            "required": ["account_id"]
        }),
    }
}

/// Create the get_connector_details tool
pub fn create_get_connector_details_tool() -> Tool {
    Tool {
        name: "get_connector_details".to_string(),
        description: "Get details of a specific connector.".to_string(),
        input_schema: json!({
            "type": "object",
            "properties": {
                "connector_id": {
                    "type": "string",
                    "description": "The ID of the connector"
                },
                "account_id": {
                    "type": "string",
                    "description": "Account ID"
                },
                "org_id": {
                    "type": "string",
                    "description": "Organization ID"
                },
                "project_id": {
                    "type": "string",
                    "description": "Project ID"
                }
            },
            "required": ["connector_id", "account_id"]
        }),
    }
}

/// Create the list_connectors tool
pub fn create_list_connectors_tool() -> Tool {
    Tool {
        name: "list_connectors".to_string(),
        description: "List connectors with filtering options.".to_string(),
        input_schema: json!({
            "type": "object",
            "properties": {
                "account_id": {
                    "type": "string",
                    "description": "Account ID"
                },
                "org_id": {
                    "type": "string",
                    "description": "Organization ID"
                },
                "project_id": {
                    "type": "string",
                    "description": "Project ID"
                },
                "search_term": {
                    "type": "string",
                    "description": "Optional search term to filter connectors"
                },
                "type": {
                    "type": "string",
                    "description": "Optional connector type filter"
                },
                "category": {
                    "type": "string",
                    "description": "Optional category filter"
                },
                "page": {
                    "type": "integer",
                    "description": "Page number for pagination"
                },
                "size": {
                    "type": "integer",
                    "description": "Page size for pagination"
                }
            },
            "required": ["account_id"]
        }),
    }
}

/// Handle connector tool calls
pub async fn handle_connector_tool_call(
    tool_name: &str,
    request: &ToolCallRequest,
    connector_service: &ConnectorService,
) -> Result<ToolCallResult> {
    match tool_name {
        "list_connector_catalogue" => handle_list_connector_catalogue(request, connector_service).await,
        "get_connector_details" => handle_get_connector_details(request, connector_service).await,
        "list_connectors" => handle_list_connectors(request, connector_service).await,
        _ => Err(harness_mcp_core::error::Error::ToolExecution(
            format!("Unknown connector tool: {}", tool_name)
        )),
    }
}

async fn handle_list_connector_catalogue(
    request: &ToolCallRequest,
    connector_service: &ConnectorService,
) -> Result<ToolCallResult> {
    let scope = extract_scope(request)?;

    match connector_service.get_catalogue(&scope).await {
        Ok(response) => {
            let json_str = serde_json::to_string_pretty(&response)
                .map_err(|e| harness_mcp_core::error::Error::Serialization(e))?;
            Ok(ToolCallResult {
                content: vec![ToolResultContent::Text { text: json_str }],
                is_error: None,
            })
        }
        Err(e) => Ok(ToolCallResult {
            content: vec![ToolResultContent::Text {
                text: format!("Error getting connector catalogue: {}", e),
            }],
            is_error: Some(true),
        }),
    }
}

async fn handle_get_connector_details(
    request: &ToolCallRequest,
    connector_service: &ConnectorService,
) -> Result<ToolCallResult> {
    let connector_id = get_required_string_param(request, "connector_id")?;
    let scope = extract_scope(request)?;

    match connector_service.get(&scope, &connector_id).await {
        Ok(response) => {
            let json_str = serde_json::to_string_pretty(&response)
                .map_err(|e| harness_mcp_core::error::Error::Serialization(e))?;
            Ok(ToolCallResult {
                content: vec![ToolResultContent::Text { text: json_str }],
                is_error: None,
            })
        }
        Err(e) => Ok(ToolCallResult {
            content: vec![ToolResultContent::Text {
                text: format!("Error getting connector details: {}", e),
            }],
            is_error: Some(true),
        }),
    }
}

async fn handle_list_connectors(
    request: &ToolCallRequest,
    connector_service: &ConnectorService,
) -> Result<ToolCallResult> {
    let scope = extract_scope(request)?;
    let search_term = get_optional_string_param(request, "search_term");
    let connector_type = get_optional_string_param(request, "type");
    let category = get_optional_string_param(request, "category");
    let page = get_optional_i32_param(request, "page");
    let size = get_optional_i32_param(request, "size");

    let options = ConnectorListOptions {
        pagination: PaginationOptions { page, size },
        search_term,
        connector_type,
        category,
    };

    match connector_service.list(&scope, &options).await {
        Ok(response) => {
            let json_str = serde_json::to_string_pretty(&response)
                .map_err(|e| harness_mcp_core::error::Error::Serialization(e))?;
            Ok(ToolCallResult {
                content: vec![ToolResultContent::Text { text: json_str }],
                is_error: None,
            })
        }
        Err(e) => Ok(ToolCallResult {
            content: vec![ToolResultContent::Text {
                text: format!("Error listing connectors: {}", e),
            }],
            is_error: Some(true),
        }),
    }
}

// Helper functions for parameter extraction
fn get_required_string_param(request: &ToolCallRequest, key: &str) -> Result<String> {
    request
        .arguments
        .get(key)
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| {
            harness_mcp_core::error::Error::InvalidRequest(format!("Missing required parameter: {}", key))
        })
}

fn get_optional_string_param(request: &ToolCallRequest, key: &str) -> Option<String> {
    request
        .arguments
        .get(key)
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

fn get_optional_i32_param(request: &ToolCallRequest, key: &str) -> Option<i32> {
    request
        .arguments
        .get(key)
        .and_then(|v| v.as_i64())
        .map(|i| i as i32)
}

fn extract_scope(request: &ToolCallRequest) -> Result<Scope> {
    let account_id = get_required_string_param(request, "account_id")?;
    let org_id = get_optional_string_param(request, "org_id");
    let project_id = get_optional_string_param(request, "project_id");

    Ok(Scope {
        account_id,
        org_id,
        project_id,
    })
}