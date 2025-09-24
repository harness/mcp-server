use harness_mcp_core::{
    config::Config,
    error::McpError,
    mcp::*,
    protocol::McpProtocolHandler,
    server::McpServer,
    tools::ToolRegistry,
};
use serde_json::json;
use tokio_test;

#[tokio::test]
async fn test_server_creation() {
    let mut config = Config::default();
    config.api_key = Some("test.account123.token456.secret789".to_string());
    
    let result = McpServer::new(config).await;
    assert!(result.is_ok());
}

#[tokio::test]
async fn test_tool_registry_creation() {
    let config = Config::default();
    let result = ToolRegistry::new(&config).await;
    assert!(result.is_ok());
    
    let registry = result.unwrap();
    let tools = registry.get_tools();
    assert!(!tools.is_empty()); // Should have at least the test tool
}

#[tokio::test]
async fn test_protocol_handler_initialization() {
    let config = Config::default();
    let tool_registry = ToolRegistry::new(&config).await.unwrap();
    let mut handler = McpProtocolHandler::new(config, tool_registry);
    
    // Test initialize request
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
    let response = handler.handle_message(message).await;
    
    assert!(response.is_ok());
    let response_msg = response.unwrap();
    assert!(response_msg.is_some());
    
    if let Some(JsonRpcMessage::Response(resp)) = response_msg {
        match resp.result {
            JsonRpcResult::Success { result } => {
                let init_response: InitializeResponse = serde_json::from_value(result).unwrap();
                assert_eq!(init_response.protocol_version, PROTOCOL_VERSION);
                assert_eq!(init_response.server_info.name, SERVER_NAME);
            }
            JsonRpcResult::Error { .. } => panic!("Expected success response"),
        }
    } else {
        panic!("Expected response message");
    }
}

#[tokio::test]
async fn test_tools_list() {
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
    
    // Now test tools/list
    let tools_request = JsonRpcRequest::new(
        json!(2),
        "tools/list".to_string(),
        None
    );
    
    let message = JsonRpcMessage::Request(tools_request);
    let response = handler.handle_message(message).await;
    
    assert!(response.is_ok());
    let response_msg = response.unwrap();
    assert!(response_msg.is_some());
    
    if let Some(JsonRpcMessage::Response(resp)) = response_msg {
        match resp.result {
            JsonRpcResult::Success { result } => {
                let tools_response: ListToolsResponse = serde_json::from_value(result).unwrap();
                assert!(!tools_response.tools.is_empty());
                
                // Check that test tool exists
                let test_tool = tools_response.tools.iter()
                    .find(|t| t.name == "test");
                assert!(test_tool.is_some());
            }
            JsonRpcResult::Error { .. } => panic!("Expected success response"),
        }
    } else {
        panic!("Expected response message");
    }
}

#[tokio::test]
async fn test_tool_execution() {
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
                "message": "Hello from test!"
            }
        }))
    );
    
    let message = JsonRpcMessage::Request(call_request);
    let response = handler.handle_message(message).await;
    
    assert!(response.is_ok());
    let response_msg = response.unwrap();
    assert!(response_msg.is_some());
    
    if let Some(JsonRpcMessage::Response(resp)) = response_msg {
        match resp.result {
            JsonRpcResult::Success { result } => {
                let call_response: CallToolResponse = serde_json::from_value(result).unwrap();
                assert!(!call_response.content.is_empty());
                assert_eq!(call_response.is_error, Some(false));
                
                if let Content::Text { text } = &call_response.content[0] {
                    assert!(text.contains("Hello from test!"));
                } else {
                    panic!("Expected text content");
                }
            }
            JsonRpcResult::Error { .. } => panic!("Expected success response"),
        }
    } else {
        panic!("Expected response message");
    }
}

#[test]
fn test_config_default() {
    let config = Config::default();
    assert_eq!(config.base_url, "https://app.harness.io");
    assert_eq!(config.toolsets, vec!["default"]);
    assert!(!config.read_only);
    assert!(!config.debug);
}

#[test]
fn test_config_account_id_extraction() {
    let mut config = Config::default();
    config.api_key = Some("pat.account123.token456.secret789".to_string());
    
    let result = config.extract_account_id();
    assert!(result.is_ok());
    assert_eq!(config.account_id, Some("account123".to_string()));
}

#[test]
fn test_config_invalid_api_key() {
    let mut config = Config::default();
    config.api_key = Some("invalid_key".to_string());
    
    let result = config.extract_account_id();
    assert!(result.is_err());
    assert!(matches!(result.unwrap_err(), McpError::InvalidApiKey));
}

#[test]
fn test_json_rpc_message_parsing() {
    let request_json = r#"{"jsonrpc":"2.0","id":1,"method":"test","params":{"key":"value"}}"#;
    let message = McpProtocolHandler::parse_message(request_json);
    assert!(message.is_ok());
    
    if let JsonRpcMessage::Request(req) = message.unwrap() {
        assert_eq!(req.jsonrpc, "2.0");
        assert_eq!(req.id, json!(1));
        assert_eq!(req.method, "test");
        assert!(req.params.is_some());
    } else {
        panic!("Expected request message");
    }
}

#[test]
fn test_json_rpc_response_serialization() {
    let response = JsonRpcResponse::success(json!(1), json!({"result": "test"}));
    let serialized = McpProtocolHandler::serialize_message(&JsonRpcMessage::Response(response));
    assert!(serialized.is_ok());
    
    let json_str = serialized.unwrap();
    assert!(json_str.contains("\"jsonrpc\":\"2.0\""));
    assert!(json_str.contains("\"id\":1"));
    assert!(json_str.contains("\"result\""));
}

#[test]
fn test_error_status_codes() {
    assert_eq!(McpError::InvalidApiKey.to_status_code(), 401);
    assert_eq!(McpError::InvalidParameter("test".to_string()).to_status_code(), 400);
    assert_eq!(McpError::RateLimitExceeded.to_status_code(), 429);
    assert_eq!(McpError::ServiceUnavailable("test".to_string()).to_status_code(), 503);
}

#[test]
fn test_error_retryability() {
    assert!(McpError::RateLimitExceeded.is_retryable());
    assert!(McpError::ServiceUnavailable("test".to_string()).is_retryable());
    assert!(McpError::TimeoutError("test".to_string()).is_retryable());
    assert!(!McpError::InvalidApiKey.is_retryable());
    assert!(!McpError::InvalidParameter("test".to_string()).is_retryable());
}