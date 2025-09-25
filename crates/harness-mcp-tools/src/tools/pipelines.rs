//! Pipeline tool implementations

use harness_mcp_client::services::PipelineService;
use harness_mcp_client::dto::{PipelineListOptions, ExecutionListOptions, Scope, PaginationOptions};
use harness_mcp_config::Config;
use harness_mcp_core::types::{Tool, ToolCallRequest, ToolCallResult, ToolResultContent};
use harness_mcp_core::error::Result;
use serde_json::{json, Value};
use std::collections::HashMap;

/// Create the get_pipeline tool
pub fn create_get_pipeline_tool() -> Tool {
    Tool {
        name: "get_pipeline".to_string(),
        description: "Get details of a specific pipeline in a Harness repository. Use list_pipelines (if available) first to find the correct pipeline_id if you're unsure of the exact ID.".to_string(),
        input_schema: json!({
            "type": "object",
            "properties": {
                "pipeline_id": {
                    "type": "string",
                    "description": "The ID of the pipeline"
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
            "required": ["pipeline_id", "account_id", "org_id", "project_id"]
        }),
    }
}

/// Create the list_pipelines tool
pub fn create_list_pipelines_tool() -> Tool {
    Tool {
        name: "list_pipelines".to_string(),
        description: "List pipelines in a Harness repository.".to_string(),
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
                    "description": "Optional search term to filter pipelines"
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

/// Create the get_execution tool
pub fn create_get_execution_tool() -> Tool {
    Tool {
        name: "get_execution".to_string(),
        description: "Get details of a specific pipeline execution.".to_string(),
        input_schema: json!({
            "type": "object",
            "properties": {
                "plan_execution_id": {
                    "type": "string",
                    "description": "The ID of the pipeline execution"
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
            "required": ["plan_execution_id", "account_id", "org_id", "project_id"]
        }),
    }
}

/// Create the list_executions tool
pub fn create_list_executions_tool() -> Tool {
    Tool {
        name: "list_executions".to_string(),
        description: "List pipeline executions.".to_string(),
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
                "pipeline_identifier": {
                    "type": "string",
                    "description": "Optional pipeline identifier to filter executions"
                },
                "status": {
                    "type": "array",
                    "items": {
                        "type": "string"
                    },
                    "description": "Optional status filter"
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

/// Create the fetch_execution_url tool
pub fn create_fetch_execution_url_tool() -> Tool {
    Tool {
        name: "fetch_execution_url".to_string(),
        description: "Fetch the execution URL for a pipeline execution in Harness.".to_string(),
        input_schema: json!({
            "type": "object",
            "properties": {
                "plan_execution_id": {
                    "type": "string",
                    "description": "The ID of the pipeline execution"
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
            "required": ["plan_execution_id", "account_id", "org_id", "project_id"]
        }),
    }
}

/// Handle pipeline tool calls
pub async fn handle_pipeline_tool_call(
    tool_name: &str,
    request: &ToolCallRequest,
    pipeline_service: &PipelineService,
) -> Result<ToolCallResult> {
    match tool_name {
        "get_pipeline" => handle_get_pipeline(request, pipeline_service).await,
        "list_pipelines" => handle_list_pipelines(request, pipeline_service).await,
        "get_execution" => handle_get_execution(request, pipeline_service).await,
        "list_executions" => handle_list_executions(request, pipeline_service).await,
        "fetch_execution_url" => handle_fetch_execution_url(request, pipeline_service).await,
        _ => Err(harness_mcp_core::error::Error::ToolExecution(
            format!("Unknown pipeline tool: {}", tool_name)
        )),
    }
}

async fn handle_get_pipeline(
    request: &ToolCallRequest,
    pipeline_service: &PipelineService,
) -> Result<ToolCallResult> {
    let pipeline_id = get_required_string_param(request, "pipeline_id")?;
    let scope = extract_scope(request)?;

    match pipeline_service.get(&scope, &pipeline_id).await {
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
                text: format!("Error getting pipeline: {}", e),
            }],
            is_error: Some(true),
        }),
    }
}

async fn handle_list_pipelines(
    request: &ToolCallRequest,
    pipeline_service: &PipelineService,
) -> Result<ToolCallResult> {
    let scope = extract_scope(request)?;
    let search_term = get_optional_string_param(request, "search_term");
    let page = get_optional_i32_param(request, "page");
    let size = get_optional_i32_param(request, "size");

    let options = PipelineListOptions {
        pagination: PaginationOptions { page, size },
        search_term,
        filter_identifier: None,
    };

    match pipeline_service.list(&scope, &options).await {
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
                text: format!("Error listing pipelines: {}", e),
            }],
            is_error: Some(true),
        }),
    }
}

async fn handle_get_execution(
    request: &ToolCallRequest,
    pipeline_service: &PipelineService,
) -> Result<ToolCallResult> {
    let plan_execution_id = get_required_string_param(request, "plan_execution_id")?;
    let scope = extract_scope(request)?;

    match pipeline_service.get_execution(&scope, &plan_execution_id).await {
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
                text: format!("Error getting execution: {}", e),
            }],
            is_error: Some(true),
        }),
    }
}

async fn handle_list_executions(
    request: &ToolCallRequest,
    pipeline_service: &PipelineService,
) -> Result<ToolCallResult> {
    let scope = extract_scope(request)?;
    let pipeline_identifier = get_optional_string_param(request, "pipeline_identifier");
    let page = get_optional_i32_param(request, "page");
    let size = get_optional_i32_param(request, "size");
    let status = get_optional_string_array_param(request, "status");

    let options = ExecutionListOptions {
        pagination: PaginationOptions { page, size },
        status,
        pipeline_identifier,
    };

    match pipeline_service.list_executions(&scope, &options).await {
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
                text: format!("Error listing executions: {}", e),
            }],
            is_error: Some(true),
        }),
    }
}

async fn handle_fetch_execution_url(
    request: &ToolCallRequest,
    pipeline_service: &PipelineService,
) -> Result<ToolCallResult> {
    let plan_execution_id = get_required_string_param(request, "plan_execution_id")?;
    let scope = extract_scope(request)?;

    match pipeline_service.get_execution_url(&scope, &plan_execution_id).await {
        Ok(url) => Ok(ToolCallResult {
            content: vec![ToolResultContent::Text { text: url }],
            is_error: None,
        }),
        Err(e) => Ok(ToolCallResult {
            content: vec![ToolResultContent::Text {
                text: format!("Error getting execution URL: {}", e),
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

fn get_optional_string_array_param(request: &ToolCallRequest, key: &str) -> Option<Vec<String>> {
    request
        .arguments
        .get(key)
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str())
                .map(|s| s.to_string())
                .collect()
        })
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