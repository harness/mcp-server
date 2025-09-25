//! Environment tool implementations

use harness_mcp_client::dto::Scope;
use harness_mcp_core::types::{Tool, ToolCallRequest, ToolCallResult, ToolResultContent};
use harness_mcp_core::error::Result;
use serde_json::json;

/// Create the list_environments tool
pub fn create_list_environments_tool() -> Tool {
    Tool {
        name: "list_environments".to_string(),
        description: "List environments in a Harness project.".to_string(),
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
                    "description": "Optional search term to filter environments"
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
            "required": ["account_id", "org_id", "project_id"]
        }),
    }
}

/// Create the get_environment tool
pub fn create_get_environment_tool() -> Tool {
    Tool {
        name: "get_environment".to_string(),
        description: "Get details of a specific environment.".to_string(),
        input_schema: json!({
            "type": "object",
            "properties": {
                "environment_id": {
                    "type": "string",
                    "description": "The ID of the environment"
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
            "required": ["environment_id", "account_id", "org_id", "project_id"]
        }),
    }
}

/// Handle environment tool calls
pub async fn handle_environment_tool_call(
    tool_name: &str,
    request: &ToolCallRequest,
) -> Result<ToolCallResult> {
    match tool_name {
        "list_environments" => handle_list_environments(request).await,
        "get_environment" => handle_get_environment(request).await,
        _ => Err(harness_mcp_core::error::Error::ToolExecution(
            format!("Unknown environment tool: {}", tool_name)
        )),
    }
}

async fn handle_list_environments(request: &ToolCallRequest) -> Result<ToolCallResult> {
    let scope = extract_scope(request)?;
    let search_term = get_optional_string_param(request, "search_term");
    let page = get_optional_i32_param(request, "page");
    let size = get_optional_i32_param(request, "size");

    // For now, return a placeholder response
    // In a real implementation, this would call the environments API
    let response = json!({
        "data": {
            "content": [],
            "totalPages": 0,
            "totalElements": 0,
            "pageSize": size.unwrap_or(20),
            "pageIndex": page.unwrap_or(0)
        }
    });

    Ok(ToolCallResult {
        content: vec![ToolResultContent::Text {
            text: serde_json::to_string_pretty(&response)
                .map_err(|e| harness_mcp_core::error::Error::Serialization(e))?,
        }],
        is_error: None,
    })
}

async fn handle_get_environment(request: &ToolCallRequest) -> Result<ToolCallResult> {
    let environment_id = get_required_string_param(request, "environment_id")?;
    let scope = extract_scope(request)?;

    // For now, return a placeholder response
    // In a real implementation, this would call the environments API
    let response = json!({
        "data": {
            "identifier": environment_id,
            "name": format!("Environment {}", environment_id),
            "description": "Sample environment",
            "orgIdentifier": scope.org_id,
            "projectIdentifier": scope.project_id,
            "type": "Production"
        }
    });

    Ok(ToolCallResult {
        content: vec![ToolResultContent::Text {
            text: serde_json::to_string_pretty(&response)
                .map_err(|e| harness_mcp_core::error::Error::Serialization(e))?,
        }],
        is_error: None,
    })
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