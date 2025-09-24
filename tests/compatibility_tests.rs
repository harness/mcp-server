use harness_mcp_core::{
    config::Config,
    mcp::*,
    protocol::McpProtocolHandler,
    tools::ToolRegistry,
};
use serde_json::{json, Value};
use std::collections::HashSet;

/// Test JSON-RPC 2.0 compliance
#[tokio::test]
async fn test_json_rpc_compliance() {
    let config = Config::default();
    let tool_registry = ToolRegistry::new(&config).await.unwrap();
    let mut handler = McpProtocolHandler::new(config, tool_registry);
    
    // Test initialize request/response
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
        // Verify JSON-RPC 2.0 compliance
        assert_eq!(resp.jsonrpc, "2.0");
        assert_eq!(resp.id, json!(1));
        
        // Verify response structure
        match resp.result {
            JsonRpcResult::Success { result } => {
                let response_obj = result.as_object().unwrap();
                assert!(response_obj.contains_key("protocolVersion"));
                assert!(response_obj.contains_key("capabilities"));
                assert!(response_obj.contains_key("serverInfo"));
            }
            JsonRpcResult::Error { .. } => panic!("Expected success response"),
        }
    }
}

/// Test MCP protocol version compatibility
#[tokio::test]
async fn test_mcp_protocol_version() {
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
                let protocol_version = result["protocolVersion"].as_str().unwrap();
                assert_eq!(protocol_version, PROTOCOL_VERSION);
                assert_eq!(protocol_version, "2024-11-05");
            }
            JsonRpcResult::Error { .. } => panic!("Expected success response"),
        }
    }
}

/// Test required MCP capabilities
#[tokio::test]
async fn test_mcp_capabilities() {
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
                let capabilities = &result["capabilities"];
                
                // Verify tools capability is present
                assert!(capabilities["tools"].is_object());
                
                // Verify server info
                let server_info = &result["serverInfo"];
                assert_eq!(server_info["name"].as_str().unwrap(), SERVER_NAME);
                assert!(server_info["version"].is_string());
            }
            JsonRpcResult::Error { .. } => panic!("Expected success response"),
        }
    }
}

/// Test tool schema compatibility
#[tokio::test]
async fn test_tool_schema_compatibility() {
    let config = Config::default();
    let tool_registry = ToolRegistry::new(&config).await.unwrap();
    let mut handler = McpProtocolHandler::new(config, tool_registry);
    
    // Initialize
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
    
    // Get tools list
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
                let tools = result["tools"].as_array().unwrap();
                assert!(!tools.is_empty());
                
                // Verify each tool has required fields
                for tool in tools {
                    assert!(tool["name"].is_string());
                    assert!(tool["description"].is_string());
                    assert!(tool["inputSchema"].is_object());
                    
                    // Verify input schema structure
                    let input_schema = &tool["inputSchema"];
                    assert_eq!(input_schema["type"].as_str().unwrap(), "object");
                    assert!(input_schema["properties"].is_object());
                }
            }
            JsonRpcResult::Error { .. } => panic!("Expected success response"),
        }
    }
}

/// Test error response format compatibility
#[tokio::test]
async fn test_error_response_compatibility() {
    let config = Config::default();
    let tool_registry = ToolRegistry::new(&config).await.unwrap();
    let mut handler = McpProtocolHandler::new(config, tool_registry);
    
    // Test method not found error
    let invalid_request = JsonRpcRequest::new(
        json!(1),
        "invalid_method".to_string(),
        None
    );
    
    let message = JsonRpcMessage::Request(invalid_request);
    let response = handler.handle_message(message).await.unwrap().unwrap();
    
    if let JsonRpcMessage::Response(resp) = response {
        // Verify JSON-RPC 2.0 compliance
        assert_eq!(resp.jsonrpc, "2.0");
        assert_eq!(resp.id, json!(1));
        
        match resp.result {
            JsonRpcResult::Error { error } => {
                assert_eq!(error.code, -32601); // Method not found
                assert_eq!(error.message, "Method not found");
            }
            JsonRpcResult::Success { .. } => panic!("Expected error response"),
        }
    }
}

/// Test parameter validation
#[tokio::test]
async fn test_parameter_validation() {
    let config = Config::default();
    let tool_registry = ToolRegistry::new(&config).await.unwrap();
    let mut handler = McpProtocolHandler::new(config, tool_registry);
    
    // Test initialize with missing parameters
    let invalid_init_request = JsonRpcRequest::new(
        json!(1),
        "initialize".to_string(),
        None // Missing required parameters
    );
    
    let message = JsonRpcMessage::Request(invalid_init_request);
    let response = handler.handle_message(message).await.unwrap().unwrap();
    
    if let JsonRpcMessage::Response(resp) = response {
        match resp.result {
            JsonRpcResult::Error { error } => {
                // Should be invalid params error
                assert_eq!(error.code, -32000); // Custom error for missing params
                assert!(error.message.contains("initialize"));
            }
            JsonRpcResult::Success { .. } => panic!("Expected error response"),
        }
    }
}

/// Test content type compatibility
#[test]
fn test_content_type_compatibility() {
    // Test text content
    let text_content = Content::Text {
        text: "Sample text content".to_string(),
    };
    
    let serialized = serde_json::to_value(&text_content).unwrap();
    assert_eq!(serialized["type"], "text");
    assert_eq!(serialized["text"], "Sample text content");
    
    // Test resource content
    let resource_content = Content::Resource {
        resource: Resource {
            uri: "file:///test.txt".to_string(),
            name: "test.txt".to_string(),
            description: Some("Test file".to_string()),
            mime_type: Some("text/plain".to_string()),
        },
    };
    
    let serialized = serde_json::to_value(&resource_content).unwrap();
    assert_eq!(serialized["type"], "resource");
    assert!(serialized["resource"].is_object());
    assert_eq!(serialized["resource"]["uri"], "file:///test.txt");
    assert_eq!(serialized["resource"]["mimeType"], "text/plain");
}

/// Test field naming compatibility (camelCase vs snake_case)
#[test]
fn test_field_naming_compatibility() {
    // Test that JSON fields use camelCase as expected by MCP protocol
    let init_response = InitializeResponse {
        protocol_version: "2024-11-05".to_string(),
        capabilities: ServerCapabilities {
            logging: None,
            prompts: None,
            resources: None,
            tools: Some(ToolsCapability {
                list_changed: Some(false),
            }),
        },
        server_info: ServerInfo {
            name: "test-server".to_string(),
            version: "1.0.0".to_string(),
        },
    };
    
    let serialized = serde_json::to_value(&init_response).unwrap();
    
    // Verify camelCase field names
    assert!(serialized["protocolVersion"].is_string());
    assert!(serialized["serverInfo"].is_object());
    assert!(serialized["capabilities"]["tools"]["listChanged"].is_boolean());
}

/// Test required vs optional fields
#[test]
fn test_required_optional_fields() {
    // Test that required fields are always present
    let tool = Tool {
        name: "test_tool".to_string(),
        description: "Test tool".to_string(),
        input_schema: json!({"type": "object"}),
    };
    
    let serialized = serde_json::to_value(&tool).unwrap();
    
    // Required fields
    assert!(serialized["name"].is_string());
    assert!(serialized["description"].is_string());
    assert!(serialized["inputSchema"].is_object());
    
    // Test call tool response with optional fields
    let call_response = CallToolResponse {
        content: vec![Content::Text {
            text: "Response".to_string(),
        }],
        is_error: None, // Optional field
    };
    
    let serialized = serde_json::to_value(&call_response).unwrap();
    assert!(serialized["content"].is_array());
    // isError should be omitted when None (depending on serde settings)
}

/// Verify all expected JSON-RPC methods are supported
#[tokio::test]
async fn test_supported_methods() {
    let config = Config::default();
    let tool_registry = ToolRegistry::new(&config).await.unwrap();
    let mut handler = McpProtocolHandler::new(config, tool_registry);
    
    let expected_methods = vec![
        "initialize",
        "tools/list", 
        "tools/call",
    ];
    
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
    
    // Test each expected method
    for (i, method) in expected_methods.iter().enumerate() {
        let request = match *method {
            "initialize" => continue, // Already tested
            "tools/list" => JsonRpcRequest::new(
                json!(i + 2),
                method.to_string(),
                None
            ),
            "tools/call" => JsonRpcRequest::new(
                json!(i + 2),
                method.to_string(),
                Some(json!({
                    "name": "test",
                    "arguments": {}
                }))
            ),
            _ => continue,
        };
        
        let message = JsonRpcMessage::Request(request);
        let response = handler.handle_message(message).await.unwrap().unwrap();
        
        if let JsonRpcMessage::Response(resp) = response {
            match resp.result {
                JsonRpcResult::Success { .. } => {
                    // Method is supported
                }
                JsonRpcResult::Error { error } => {
                    // Should not be "method not found" error
                    assert_ne!(error.code, -32601, "Method {} not supported", method);
                }
            }
        }
    }
}