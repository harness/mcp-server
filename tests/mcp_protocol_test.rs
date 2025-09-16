use serde_json::json;
use harness_mcp_server::mcp::protocol::*;

#[tokio::test]
async fn test_mcp_initialize_request_deserialization() {
    let json_data = json!({
        "protocolVersion": "2024-11-05",
        "capabilities": {
            "experimental": {},
            "sampling": {}
        },
        "clientInfo": {
            "name": "test-client",
            "version": "1.0.0"
        }
    });

    let request: Result<InitializeRequest, _> = serde_json::from_value(json_data);
    assert!(request.is_ok());
    
    let req = request.unwrap();
    assert_eq!(req.protocol_version, "2024-11-05");
    assert_eq!(req.client_info.name, "test-client");
    assert_eq!(req.client_info.version, "1.0.0");
}

#[tokio::test]
async fn test_mcp_initialize_response_serialization() {
    let response = InitializeResponse {
        protocol_version: MCP_VERSION.to_string(),
        capabilities: ServerCapabilities {
            experimental: None,
            logging: Some(LoggingCapabilities {}),
            prompts: None,
            resources: None,
            tools: Some(ToolsCapabilities {
                list_changed: Some(false),
            }),
        },
        server_info: ServerInfo {
            name: "harness-mcp-server".to_string(),
            version: "0.1.0".to_string(),
        },
    };

    let json_result = serde_json::to_value(&response);
    assert!(json_result.is_ok());
    
    let json = json_result.unwrap();
    assert_eq!(json["protocolVersion"], MCP_VERSION);
    assert_eq!(json["serverInfo"]["name"], "harness-mcp-server");
}

#[tokio::test]
async fn test_tool_definition_serialization() {
    let tool = Tool {
        name: "get_pipeline".to_string(),
        description: "Get pipeline details".to_string(),
        input_schema: ToolInputSchema {
            schema_type: "object".to_string(),
            properties: Some({
                let mut props = std::collections::HashMap::new();
                props.insert("pipeline_id".to_string(), json!({
                    "type": "string",
                    "description": "Pipeline identifier"
                }));
                props
            }),
            required: Some(vec!["pipeline_id".to_string()]),
        },
    };

    let json_result = serde_json::to_value(&tool);
    assert!(json_result.is_ok());
    
    let json = json_result.unwrap();
    assert_eq!(json["name"], "get_pipeline");
    assert_eq!(json["inputSchema"]["type"], "object");
    assert!(json["inputSchema"]["properties"]["pipeline_id"].is_object());
}

#[tokio::test]
async fn test_call_tool_request_deserialization() {
    let json_data = json!({
        "name": "list_pipelines",
        "arguments": {
            "account_id": "test_account",
            "org_id": "test_org",
            "page": 0,
            "size": 20
        }
    });

    let request: Result<CallToolRequest, _> = serde_json::from_value(json_data);
    assert!(request.is_ok());
    
    let req = request.unwrap();
    assert_eq!(req.name, "list_pipelines");
    assert!(req.arguments.is_some());
    
    let args = req.arguments.unwrap();
    assert_eq!(args["account_id"], "test_account");
    assert_eq!(args["page"], 0);
}

#[tokio::test]
async fn test_call_tool_response_serialization() {
    let response = CallToolResponse {
        content: vec![
            ToolContent::Text {
                text: "Pipeline data here".to_string(),
            }
        ],
        is_error: Some(false),
    };

    let json_result = serde_json::to_value(&response);
    assert!(json_result.is_ok());
    
    let json = json_result.unwrap();
    assert_eq!(json["isError"], false);
    assert!(json["content"].is_array());
    assert_eq!(json["content"][0]["type"], "text");
}

#[tokio::test]
async fn test_jsonrpc_request_serialization() {
    let request = JsonRpcRequest {
        jsonrpc: "2.0".to_string(),
        id: Some(json!(1)),
        method: "tools/list".to_string(),
        params: Some(json!({})),
    };

    let json_result = serde_json::to_value(&request);
    assert!(json_result.is_ok());
    
    let json = json_result.unwrap();
    assert_eq!(json["jsonrpc"], "2.0");
    assert_eq!(json["method"], "tools/list");
    assert_eq!(json["id"], 1);
}

#[tokio::test]
async fn test_jsonrpc_response_serialization() {
    let response = JsonRpcResponse::success(
        Some(json!(1)),
        json!({"tools": []})
    );

    let json_result = serde_json::to_value(&response);
    assert!(json_result.is_ok());
    
    let json = json_result.unwrap();
    assert_eq!(json["jsonrpc"], "2.0");
    assert_eq!(json["id"], 1);
    assert!(json["result"].is_object());
    assert!(json.get("error").is_none());
}

#[tokio::test]
async fn test_jsonrpc_error_response() {
    let error_response = JsonRpcResponse::error(
        Some(json!(1)),
        JsonRpcError::method_not_found()
    );

    let json_result = serde_json::to_value(&error_response);
    assert!(json_result.is_ok());
    
    let json = json_result.unwrap();
    assert_eq!(json["jsonrpc"], "2.0");
    assert_eq!(json["id"], 1);
    assert!(json.get("result").is_none());
    assert_eq!(json["error"]["code"], -32601);
    assert_eq!(json["error"]["message"], "Method not found");
}

#[tokio::test]
async fn test_list_tools_response() {
    let tools = vec![
        Tool {
            name: "get_pipeline".to_string(),
            description: "Get pipeline details".to_string(),
            input_schema: ToolInputSchema {
                schema_type: "object".to_string(),
                properties: None,
                required: None,
            },
        },
        Tool {
            name: "list_connectors".to_string(),
            description: "List connectors".to_string(),
            input_schema: ToolInputSchema {
                schema_type: "object".to_string(),
                properties: None,
                required: None,
            },
        },
    ];

    let response = ListToolsResponse { tools };
    let json_result = serde_json::to_value(&response);
    assert!(json_result.is_ok());
    
    let json = json_result.unwrap();
    assert!(json["tools"].is_array());
    assert_eq!(json["tools"].as_array().unwrap().len(), 2);
    assert_eq!(json["tools"][0]["name"], "get_pipeline");
    assert_eq!(json["tools"][1]["name"], "list_connectors");
}

#[tokio::test]
async fn test_tool_content_variants() {
    // Test text content
    let text_content = ToolContent::Text {
        text: "Some text response".to_string(),
    };
    let json_result = serde_json::to_value(&text_content);
    assert!(json_result.is_ok());
    let json = json_result.unwrap();
    assert_eq!(json["type"], "text");
    assert_eq!(json["text"], "Some text response");

    // Test image content
    let image_content = ToolContent::Image {
        data: "base64data".to_string(),
        mime_type: "image/png".to_string(),
    };
    let json_result = serde_json::to_value(&image_content);
    assert!(json_result.is_ok());
    let json = json_result.unwrap();
    assert_eq!(json["type"], "image");
    assert_eq!(json["data"], "base64data");
    assert_eq!(json["mimeType"], "image/png");

    // Test resource content
    let resource_content = ToolContent::Resource {
        resource: ResourceReference {
            uri: "file://test.txt".to_string(),
            text: Some("Resource text".to_string()),
        },
    };
    let json_result = serde_json::to_value(&resource_content);
    assert!(json_result.is_ok());
    let json = json_result.unwrap();
    assert_eq!(json["type"], "resource");
    assert_eq!(json["resource"]["uri"], "file://test.txt");
}