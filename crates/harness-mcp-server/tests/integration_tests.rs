//! Integration tests for Harness MCP Server

use harness_mcp_config::Config;
use harness_mcp_core::{
    types::{JsonRpcRequest, JsonRpcResponse, ToolCallRequest},
    mcp::McpProtocol,
};
use harness_mcp_server::server::{create_mcp_server, create_protocol};
use serde_json::json;
use std::sync::Arc;
use tokio;

#[tokio::test]
async fn test_server_initialization() {
    let config = create_test_config();
    let api_key = "pat.test_account.test_token.test_value".to_string();
    
    let server = create_mcp_server(&config, Some(api_key), None).await;
    assert!(server.is_ok());
}

#[tokio::test]
async fn test_protocol_creation() {
    let config = create_test_config();
    let api_key = "pat.test_account.test_token.test_value".to_string();
    
    let server = create_mcp_server(&config, Some(api_key), None).await.unwrap();
    let protocol = create_protocol(server, "test-server");
    
    assert!(!protocol.server_info.name.is_empty());
    assert!(!protocol.server_info.version.is_empty());
}

#[tokio::test]
async fn test_initialize_request() {
    let config = create_test_config();
    let api_key = "pat.test_account.test_token.test_value".to_string();
    
    let server = create_mcp_server(&config, Some(api_key), None).await.unwrap();
    let protocol = create_protocol(server, "test-server");
    
    let request = JsonRpcRequest {
        jsonrpc: "2.0".to_string(),
        id: Some(json!(1)),
        method: "initialize".to_string(),
        params: Some(json!({
            "protocolVersion": "2024-11-05",
            "clientInfo": {
                "name": "test-client",
                "version": "1.0.0"
            },
            "capabilities": {}
        })),
    };
    
    let response = protocol.handle_request(request).await;
    assert!(response.is_ok());
    
    let response = response.unwrap();
    assert_eq!(response.jsonrpc, "2.0");
    assert!(response.result.is_some());
    assert!(response.error.is_none());
}

#[tokio::test]
async fn test_list_tools_request() {
    let config = create_test_config();
    let api_key = "pat.test_account.test_token.test_value".to_string();
    
    let server = create_mcp_server(&config, Some(api_key), None).await.unwrap();
    let protocol = create_protocol(server, "test-server");
    
    // First initialize
    let init_request = JsonRpcRequest {
        jsonrpc: "2.0".to_string(),
        id: Some(json!(1)),
        method: "initialize".to_string(),
        params: Some(json!({
            "protocolVersion": "2024-11-05",
            "clientInfo": {
                "name": "test-client",
                "version": "1.0.0"
            },
            "capabilities": {}
        })),
    };
    
    let _ = protocol.handle_request(init_request).await.unwrap();
    
    // Then list tools
    let request = JsonRpcRequest {
        jsonrpc: "2.0".to_string(),
        id: Some(json!(2)),
        method: "tools/list".to_string(),
        params: None,
    };
    
    let response = protocol.handle_request(request).await;
    assert!(response.is_ok());
    
    let response = response.unwrap();
    assert_eq!(response.jsonrpc, "2.0");
    assert!(response.result.is_some());
    assert!(response.error.is_none());
    
    // Verify tools are returned
    let result = response.result.unwrap();
    let tools = result["tools"].as_array().unwrap();
    assert!(!tools.is_empty());
}

#[tokio::test]
async fn test_tool_call_request() {
    let config = create_test_config();
    let api_key = "pat.test_account.test_token.test_value".to_string();
    
    let server = create_mcp_server(&config, Some(api_key), None).await.unwrap();
    let protocol = create_protocol(server, "test-server");
    
    // Initialize first
    let init_request = JsonRpcRequest {
        jsonrpc: "2.0".to_string(),
        id: Some(json!(1)),
        method: "initialize".to_string(),
        params: Some(json!({
            "protocolVersion": "2024-11-05",
            "clientInfo": {
                "name": "test-client",
                "version": "1.0.0"
            },
            "capabilities": {}
        })),
    };
    
    let _ = protocol.handle_request(init_request).await.unwrap();
    
    // Call a tool
    let request = JsonRpcRequest {
        jsonrpc: "2.0".to_string(),
        id: Some(json!(3)),
        method: "tools/call".to_string(),
        params: Some(json!({
            "name": "list_pipelines",
            "arguments": {
                "account_id": "test_account",
                "org_id": "test_org",
                "project_id": "test_project"
            }
        })),
    };
    
    let response = protocol.handle_request(request).await;
    assert!(response.is_ok());
    
    let response = response.unwrap();
    assert_eq!(response.jsonrpc, "2.0");
    // Note: This might return an error due to invalid credentials, but the protocol should handle it
    assert!(response.result.is_some() || response.error.is_some());
}

#[tokio::test]
async fn test_invalid_method_request() {
    let config = create_test_config();
    let api_key = "pat.test_account.test_token.test_value".to_string();
    
    let server = create_mcp_server(&config, Some(api_key), None).await.unwrap();
    let protocol = create_protocol(server, "test-server");
    
    let request = JsonRpcRequest {
        jsonrpc: "2.0".to_string(),
        id: Some(json!(1)),
        method: "invalid/method".to_string(),
        params: None,
    };
    
    let response = protocol.handle_request(request).await;
    assert!(response.is_ok());
    
    let response = response.unwrap();
    assert_eq!(response.jsonrpc, "2.0");
    assert!(response.error.is_some());
    assert!(response.result.is_none());
    
    let error = response.error.unwrap();
    assert_eq!(error.code, -32601); // Method not found
}

#[tokio::test]
async fn test_malformed_request() {
    let config = create_test_config();
    let api_key = "pat.test_account.test_token.test_value".to_string();
    
    let server = create_mcp_server(&config, Some(api_key), None).await.unwrap();
    let protocol = create_protocol(server, "test-server");
    
    let request = JsonRpcRequest {
        jsonrpc: "1.0".to_string(), // Wrong version
        id: Some(json!(1)),
        method: "initialize".to_string(),
        params: None,
    };
    
    let response = protocol.handle_request(request).await;
    assert!(response.is_ok());
    
    let response = response.unwrap();
    assert!(response.error.is_some());
}

fn create_test_config() -> Config {
    Config {
        server: harness_mcp_config::ServerConfig {
            read_only: true,
        },
        harness: harness_mcp_config::HarnessConfig {
            base_url: "https://app.harness.io".to_string(),
        },
        auth: harness_mcp_config::AuthConfig {
            api_key: None,
        },
        toolsets: harness_mcp_config::ToolsetsConfig {
            enabled: vec!["pipelines".to_string(), "connectors".to_string()],
        },
    }
}