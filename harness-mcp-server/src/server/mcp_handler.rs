use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use tracing::{info, warn};

use crate::{
    error::AppError,
    server::http_server::HttpServerState,
};

#[derive(Debug, Deserialize)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    pub id: Option<Value>,
    pub method: String,
    pub params: Option<Value>,
}

#[derive(Debug, Serialize)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    pub id: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<JsonRpcError>,
}

#[derive(Debug, Serialize)]
pub struct JsonRpcError {
    pub code: i32,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
}

// MCP Protocol error codes
const PARSE_ERROR: i32 = -32700;
const INVALID_REQUEST: i32 = -32600;
const METHOD_NOT_FOUND: i32 = -32601;
const INVALID_PARAMS: i32 = -32602;
const INTERNAL_ERROR: i32 = -32603;

pub async fn handle_mcp_request(
    State(state): State<HttpServerState>,
    Json(payload): Json<Value>,
) -> Result<Json<JsonRpcResponse>, AppError> {
    info!("Received MCP request: {:?}", payload);

    // Parse the JSON-RPC request
    let request: JsonRpcRequest = match serde_json::from_value(payload) {
        Ok(req) => req,
        Err(e) => {
            warn!("Failed to parse JSON-RPC request: {}", e);
            return Ok(Json(JsonRpcResponse {
                jsonrpc: "2.0".to_string(),
                id: None,
                result: None,
                error: Some(JsonRpcError {
                    code: PARSE_ERROR,
                    message: "Parse error".to_string(),
                    data: Some(json!({"details": e.to_string()})),
                }),
            }));
        }
    };

    // Validate JSON-RPC version
    if request.jsonrpc != "2.0" {
        return Ok(Json(JsonRpcResponse {
            jsonrpc: "2.0".to_string(),
            id: request.id,
            result: None,
            error: Some(JsonRpcError {
                code: INVALID_REQUEST,
                message: "Invalid Request".to_string(),
                data: Some(json!({"details": "JSON-RPC version must be 2.0"})),
            }),
        }));
    }

    // Route the request based on method
    let result = match request.method.as_str() {
        "initialize" => handle_initialize(&state, request.params).await,
        "tools/list" => handle_tools_list(&state, request.params).await,
        "tools/call" => handle_tools_call(&state, request.params).await,
        "resources/list" => handle_resources_list(&state, request.params).await,
        "resources/read" => handle_resources_read(&state, request.params).await,
        "prompts/list" => handle_prompts_list(&state, request.params).await,
        "prompts/get" => handle_prompts_get(&state, request.params).await,
        _ => Err(JsonRpcError {
            code: METHOD_NOT_FOUND,
            message: "Method not found".to_string(),
            data: Some(json!({"method": request.method})),
        }),
    };

    match result {
        Ok(result_value) => Ok(Json(JsonRpcResponse {
            jsonrpc: "2.0".to_string(),
            id: request.id,
            result: Some(result_value),
            error: None,
        })),
        Err(error) => Ok(Json(JsonRpcResponse {
            jsonrpc: "2.0".to_string(),
            id: request.id,
            result: None,
            error: Some(error),
        })),
    }
}

async fn handle_initialize(
    _state: &HttpServerState,
    params: Option<Value>,
) -> Result<Value, JsonRpcError> {
    info!("Handling initialize request");
    
    // Parse client info if provided
    let client_info = if let Some(ref p) = params {
        if let Some(ci) = p.get("clientInfo") {
            Some(json!({
                "name": ci.get("name").unwrap_or(&json!("unknown")),
                "version": ci.get("version").unwrap_or(&json!("unknown"))
            }))
        } else {
            None
        }
    } else {
        None
    };

    if let Some(ref info) = client_info {
        info!("Client connected: {:?}", info);
    }

    Ok(json!({
        "protocolVersion": "2024-11-05",
        "capabilities": {
            "tools": {
                "listChanged": true
            },
            "resources": {
                "subscribe": true,
                "listChanged": true
            },
            "prompts": {
                "listChanged": true
            },
            "logging": {}
        },
        "serverInfo": {
            "name": "harness-mcp-server",
            "version": env!("CARGO_PKG_VERSION")
        }
    }))
}

async fn handle_tools_list(
    _state: &HttpServerState,
    _params: Option<Value>,
) -> Result<Value, JsonRpcError> {
    info!("Handling tools/list request");
    
    // TODO: Implement actual tool listing based on enabled toolsets
    // For now, return a basic set of tools
    Ok(json!({
        "tools": [
            {
                "name": "list_pipelines",
                "description": "List pipelines in the account/org/project",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "account_id": {"type": "string"},
                        "org_id": {"type": "string", "description": "Organization ID"},
                        "project_id": {"type": "string", "description": "Project ID"}
                    },
                    "required": ["account_id"]
                }
            },
            {
                "name": "get_pipeline",
                "description": "Get details of a specific pipeline",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "account_id": {"type": "string"},
                        "org_id": {"type": "string"},
                        "project_id": {"type": "string"},
                        "pipeline_id": {"type": "string"}
                    },
                    "required": ["account_id", "pipeline_id"]
                }
            },
            {
                "name": "list_connectors",
                "description": "List connectors in the account/org/project",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "account_id": {"type": "string"},
                        "org_id": {"type": "string"},
                        "project_id": {"type": "string"}
                    },
                    "required": ["account_id"]
                }
            }
        ]
    }))
}

async fn handle_tools_call(
    _state: &HttpServerState,
    params: Option<Value>,
) -> Result<Value, JsonRpcError> {
    info!("Handling tools/call request");
    
    let params = params.ok_or_else(|| JsonRpcError {
        code: INVALID_PARAMS,
        message: "Missing parameters".to_string(),
        data: None,
    })?;

    let tool_name = params.get("name")
        .and_then(|n| n.as_str())
        .ok_or_else(|| JsonRpcError {
            code: INVALID_PARAMS,
            message: "Missing tool name".to_string(),
            data: None,
        })?;

    // TODO: Implement actual tool execution
    match tool_name {
        "list_pipelines" => {
            Ok(json!({
                "content": [
                    {
                        "type": "text",
                        "text": "Pipeline listing not yet implemented in Rust version"
                    }
                ]
            }))
        }
        "get_pipeline" => {
            Ok(json!({
                "content": [
                    {
                        "type": "text", 
                        "text": "Pipeline details not yet implemented in Rust version"
                    }
                ]
            }))
        }
        "list_connectors" => {
            Ok(json!({
                "content": [
                    {
                        "type": "text",
                        "text": "Connector listing not yet implemented in Rust version"
                    }
                ]
            }))
        }
        _ => Err(JsonRpcError {
            code: METHOD_NOT_FOUND,
            message: format!("Unknown tool: {}", tool_name),
            data: None,
        })
    }
}

async fn handle_resources_list(
    _state: &HttpServerState,
    _params: Option<Value>,
) -> Result<Value, JsonRpcError> {
    info!("Handling resources/list request");
    
    // TODO: Implement resource listing
    Ok(json!({
        "resources": []
    }))
}

async fn handle_resources_read(
    _state: &HttpServerState,
    _params: Option<Value>,
) -> Result<Value, JsonRpcError> {
    info!("Handling resources/read request");
    
    // TODO: Implement resource reading
    Err(JsonRpcError {
        code: METHOD_NOT_FOUND,
        message: "Resource reading not yet implemented".to_string(),
        data: None,
    })
}

async fn handle_prompts_list(
    _state: &HttpServerState,
    _params: Option<Value>,
) -> Result<Value, JsonRpcError> {
    info!("Handling prompts/list request");
    
    // TODO: Implement prompt listing
    Ok(json!({
        "prompts": []
    }))
}

async fn handle_prompts_get(
    _state: &HttpServerState,
    _params: Option<Value>,
) -> Result<Value, JsonRpcError> {
    info!("Handling prompts/get request");
    
    // TODO: Implement prompt retrieval
    Err(JsonRpcError {
        code: METHOD_NOT_FOUND,
        message: "Prompt retrieval not yet implemented".to_string(),
        data: None,
    })
}