use harness_mcp_core::{
    config::Config,
    mcp::*,
    protocol::McpProtocolHandler,
    tools::ToolRegistry,
};
use insta::assert_json_snapshot;
use serde_json::json;

#[tokio::test]
async fn test_initialize_response_snapshot() {
    let config = Config::default();
    let tool_registry = ToolRegistry::new(&config).await.unwrap();
    let mut handler = McpProtocolHandler::new(config, tool_registry);
    
    let init_request = JsonRpcRequest::new(
        json!(1),
        "initialize".to_string(),
        Some(json!({
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {
                "name": "test-client",
                "version": "1.0.0"
            }
        }))
    );
    
    let message = JsonRpcMessage::Request(init_request);
    let response = handler.handle_message(message).await.unwrap().unwrap();
    
    if let JsonRpcMessage::Response(resp) = response {
        match resp.result {
            JsonRpcResult::Success { result } => {
                assert_json_snapshot!("initialize_response", result);
            }
            JsonRpcResult::Error { .. } => panic!("Expected success response"),
        }
    }
}

#[tokio::test]
async fn test_tools_list_response_snapshot() {
    let config = Config::default();
    let tool_registry = ToolRegistry::new(&config).await.unwrap();
    let mut handler = McpProtocolHandler::new(config, tool_registry);
    
    // Initialize first
    let init_request = JsonRpcRequest::new(
        json!(1),
        "initialize".to_string(),
        Some(json!({
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {
                "name": "test-client",
                "version": "1.0.0"
            }
        }))
    );
    
    let init_message = JsonRpcMessage::Request(init_request);
    handler.handle_message(init_message).await.unwrap();
    
    // Send initialized notification
    let initialized_notification = JsonRpcNotification {
        jsonrpc: "2.0".to_string(),
        method: "initialized".to_string(),
        params: None,
    };
    
    let init_notif_message = JsonRpcMessage::Notification(initialized_notification);
    handler.handle_message(init_notif_message).await.unwrap();
    
    // Test tools/list
    let tools_request = JsonRpcRequest::new(
        json!(2),
        "tools/list".to_string(),
        None
    );
    
    let message = JsonRpcMessage::Request(tools_request);
    let response = handler.handle_message(message).await.unwrap().unwrap();
    
    if let JsonRpcMessage::Response(resp) = response {
        match resp.result {
            JsonRpcResult::Success { result } => {
                assert_json_snapshot!("tools_list_response", result);
            }
            JsonRpcResult::Error { .. } => panic!("Expected success response"),
        }
    }
}

#[tokio::test]
async fn test_tool_call_response_snapshot() {
    let config = Config::default();
    let tool_registry = ToolRegistry::new(&config).await.unwrap();
    let mut handler = McpProtocolHandler::new(config, tool_registry);
    
    // Initialize first
    let init_request = JsonRpcRequest::new(
        json!(1),
        "initialize".to_string(),
        Some(json!({
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {
                "name": "test-client",
                "version": "1.0.0"
            }
        }))
    );
    
    let init_message = JsonRpcMessage::Request(init_request);
    handler.handle_message(init_message).await.unwrap();
    
    // Send initialized notification
    let initialized_notification = JsonRpcNotification {
        jsonrpc: "2.0".to_string(),
        method: "initialized".to_string(),
        params: None,
    };
    
    let init_notif_message = JsonRpcMessage::Notification(initialized_notification);
    handler.handle_message(init_notif_message).await.unwrap();
    
    // Test tool execution
    let call_request = JsonRpcRequest::new(
        json!(3),
        "tools/call".to_string(),
        Some(json!({
            "name": "test",
            "arguments": {
                "message": "Hello from snapshot test!"
            }
        }))
    );
    
    let message = JsonRpcMessage::Request(call_request);
    let response = handler.handle_message(message).await.unwrap().unwrap();
    
    if let JsonRpcMessage::Response(resp) = response {
        match resp.result {
            JsonRpcResult::Success { result } => {
                assert_json_snapshot!("tool_call_response", result);
            }
            JsonRpcResult::Error { .. } => panic!("Expected success response"),
        }
    }
}

#[tokio::test]
async fn test_error_response_snapshot() {
    let config = Config::default();
    let tool_registry = ToolRegistry::new(&config).await.unwrap();
    let mut handler = McpProtocolHandler::new(config, tool_registry);
    
    // Test invalid method
    let invalid_request = JsonRpcRequest::new(
        json!(1),
        "invalid_method".to_string(),
        None
    );
    
    let message = JsonRpcMessage::Request(invalid_request);
    let response = handler.handle_message(message).await.unwrap().unwrap();
    
    if let JsonRpcMessage::Response(resp) = response {
        match resp.result {
            JsonRpcResult::Error { error } => {
                assert_json_snapshot!("method_not_found_error", error);
            }
            JsonRpcResult::Success { .. } => panic!("Expected error response"),
        }
    }
}

#[tokio::test]
async fn test_tool_not_found_error_snapshot() {
    let config = Config::default();
    let tool_registry = ToolRegistry::new(&config).await.unwrap();
    let mut handler = McpProtocolHandler::new(config, tool_registry);
    
    // Initialize first
    let init_request = JsonRpcRequest::new(
        json!(1),
        "initialize".to_string(),
        Some(json!({
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {
                "name": "test-client",
                "version": "1.0.0"
            }
        }))
    );
    
    let init_message = JsonRpcMessage::Request(init_request);
    handler.handle_message(init_message).await.unwrap();
    
    // Send initialized notification
    let initialized_notification = JsonRpcNotification {
        jsonrpc: "2.0".to_string(),
        method: "initialized".to_string(),
        params: None,
    };
    
    let init_notif_message = JsonRpcMessage::Notification(initialized_notification);
    handler.handle_message(init_notif_message).await.unwrap();
    
    // Test calling non-existent tool
    let call_request = JsonRpcRequest::new(
        json!(2),
        "tools/call".to_string(),
        Some(json!({
            "name": "nonexistent_tool",
            "arguments": {}
        }))
    );
    
    let message = JsonRpcMessage::Request(call_request);
    let response = handler.handle_message(message).await.unwrap().unwrap();
    
    if let JsonRpcMessage::Response(resp) = response {
        match resp.result {
            JsonRpcResult::Error { error } => {
                assert_json_snapshot!("tool_not_found_error", error);
            }
            JsonRpcResult::Success { .. } => panic!("Expected error response"),
        }
    }
}

#[test]
fn test_json_rpc_message_serialization_snapshots() {
    // Test request serialization
    let request = JsonRpcRequest::new(
        json!(1),
        "test_method".to_string(),
        Some(json!({"param": "value"}))
    );
    let request_message = JsonRpcMessage::Request(request);
    let serialized_request = McpProtocolHandler::serialize_message(&request_message).unwrap();
    let request_json: serde_json::Value = serde_json::from_str(&serialized_request).unwrap();
    assert_json_snapshot!("json_rpc_request", request_json);
    
    // Test success response serialization
    let success_response = JsonRpcResponse::success(
        json!(1),
        json!({"result": "success"})
    );
    let success_message = JsonRpcMessage::Response(success_response);
    let serialized_success = McpProtocolHandler::serialize_message(&success_message).unwrap();
    let success_json: serde_json::Value = serde_json::from_str(&serialized_success).unwrap();
    assert_json_snapshot!("json_rpc_success_response", success_json);
    
    // Test error response serialization
    let error_response = JsonRpcResponse::error(
        json!(1),
        JsonRpcError::method_not_found()
    );
    let error_message = JsonRpcMessage::Response(error_response);
    let serialized_error = McpProtocolHandler::serialize_message(&error_message).unwrap();
    let error_json: serde_json::Value = serde_json::from_str(&serialized_error).unwrap();
    assert_json_snapshot!("json_rpc_error_response", error_json);
    
    // Test notification serialization
    let notification = JsonRpcNotification {
        jsonrpc: "2.0".to_string(),
        method: "test_notification".to_string(),
        params: Some(json!({"data": "notification_data"})),
    };
    let notification_message = JsonRpcMessage::Notification(notification);
    let serialized_notification = McpProtocolHandler::serialize_message(&notification_message).unwrap();
    let notification_json: serde_json::Value = serde_json::from_str(&serialized_notification).unwrap();
    assert_json_snapshot!("json_rpc_notification", notification_json);
}

#[test]
fn test_mcp_types_serialization_snapshots() {
    // Test Tool serialization
    let tool = Tool {
        name: "test_tool".to_string(),
        description: "A test tool for snapshot testing".to_string(),
        input_schema: json!({
            "type": "object",
            "properties": {
                "message": {
                    "type": "string",
                    "description": "A test message"
                },
                "count": {
                    "type": "number",
                    "description": "A test count"
                }
            },
            "required": ["message"]
        }),
    };
    assert_json_snapshot!("tool_definition", tool);
    
    // Test InitializeResponse serialization
    let init_response = InitializeResponse {
        protocol_version: PROTOCOL_VERSION.to_string(),
        capabilities: ServerCapabilities {
            logging: Some(LoggingCapability {}),
            prompts: None,
            resources: None,
            tools: Some(ToolsCapability {
                list_changed: Some(false),
            }),
        },
        server_info: ServerInfo {
            name: SERVER_NAME.to_string(),
            version: "0.1.0".to_string(),
        },
    };
    assert_json_snapshot!("initialize_response_structure", init_response);
    
    // Test CallToolResponse serialization
    let call_response = CallToolResponse {
        content: vec![
            Content::Text {
                text: "This is a test response".to_string(),
            },
            Content::Resource {
                resource: Resource {
                    uri: "file:///test.txt".to_string(),
                    name: "test.txt".to_string(),
                    description: Some("A test file".to_string()),
                    mime_type: Some("text/plain".to_string()),
                },
            },
        ],
        is_error: Some(false),
    };
    assert_json_snapshot!("call_tool_response_structure", call_response);
}