//! Core MCP protocol implementation for Harness
//!
//! This crate provides the foundational Model Context Protocol (MCP) implementation
//! including types, server traits, transport layers, and protocol handling.

pub mod error;
pub mod logging;
pub mod mcp;
pub mod server;
pub mod transport;
pub mod types;

pub use error::{Error, Result};

/// Re-export commonly used types
pub mod prelude {
    pub use crate::error::{Error, Result};
    pub use crate::logging::*;
    pub use crate::mcp::*;
    pub use crate::server::*;
    pub use crate::transport::*;
    pub use crate::types::*;
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::server::{DefaultMcpServer, McpServer};
    use crate::types::*;
    use std::sync::Arc;
    use tokio;

    #[tokio::test]
    async fn test_default_mcp_server_creation() {
        let server = DefaultMcpServer::new();
        let capabilities = server.get_capabilities().await.unwrap();
        
        assert!(capabilities.tools.is_some());
        assert!(capabilities.logging.is_some());
        assert!(capabilities.resources.is_some());
        assert!(capabilities.prompts.is_some());
    }

    #[tokio::test]
    async fn test_tool_registration() {
        let server = Arc::new(DefaultMcpServer::new());
        
        let tool = Tool {
            name: "test_tool".to_string(),
            description: "A test tool".to_string(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "param": {"type": "string"}
                }
            }),
        };
        
        let handler = Arc::new(move |_request| {
            Box::pin(async move {
                Ok(ToolCallResult {
                    content: vec![ToolResultContent::Text {
                        text: "Test response".to_string(),
                    }],
                    is_error: None,
                })
            })
        });
        
        server.add_tool(tool.clone(), handler).await;
        
        let tools = server.list_tools().await.unwrap();
        assert_eq!(tools.len(), 1);
        assert_eq!(tools[0].name, "test_tool");
    }

    #[tokio::test]
    async fn test_tool_call() {
        let server = Arc::new(DefaultMcpServer::new());
        
        let tool = Tool {
            name: "echo_tool".to_string(),
            description: "Echoes input".to_string(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "message": {"type": "string"}
                }
            }),
        };
        
        let handler = Arc::new(move |request| {
            Box::pin(async move {
                let message = request.arguments.get("message")
                    .and_then(|v| v.as_str())
                    .unwrap_or("No message");
                
                Ok(ToolCallResult {
                    content: vec![ToolResultContent::Text {
                        text: format!("Echo: {}", message),
                    }],
                    is_error: None,
                })
            })
        });
        
        server.add_tool(tool, handler).await;
        
        let request = ToolCallRequest {
            name: "echo_tool".to_string(),
            arguments: serde_json::json!({"message": "Hello, World!"}).as_object().unwrap().clone(),
        };
        
        let result = server.call_tool(request).await.unwrap();
        assert_eq!(result.content.len(), 1);
        
        if let ToolResultContent::Text { text } = &result.content[0] {
            assert_eq!(text, "Echo: Hello, World!");
        } else {
            panic!("Expected text content");
        }
    }

    #[test]
    fn test_json_rpc_request_serialization() {
        let request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: Some(serde_json::json!(1)),
            method: "test_method".to_string(),
            params: Some(serde_json::json!({"param": "value"})),
        };
        
        let serialized = serde_json::to_string(&request).unwrap();
        let deserialized: JsonRpcRequest = serde_json::from_str(&serialized).unwrap();
        
        assert_eq!(request.jsonrpc, deserialized.jsonrpc);
        assert_eq!(request.method, deserialized.method);
    }

    #[test]
    fn test_json_rpc_response_serialization() {
        let response = JsonRpcResponse {
            jsonrpc: "2.0".to_string(),
            id: Some(serde_json::json!(1)),
            result: Some(serde_json::json!({"status": "ok"})),
            error: None,
        };
        
        let serialized = serde_json::to_string(&response).unwrap();
        let deserialized: JsonRpcResponse = serde_json::from_str(&serialized).unwrap();
        
        assert_eq!(response.jsonrpc, deserialized.jsonrpc);
        assert!(deserialized.result.is_some());
        assert!(deserialized.error.is_none());
    }

    #[test]
    fn test_tool_serialization() {
        let tool = Tool {
            name: "test_tool".to_string(),
            description: "A test tool".to_string(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "param": {"type": "string"}
                }
            }),
        };
        
        let serialized = serde_json::to_string(&tool).unwrap();
        let deserialized: Tool = serde_json::from_str(&serialized).unwrap();
        
        assert_eq!(tool.name, deserialized.name);
        assert_eq!(tool.description, deserialized.description);
    }
}