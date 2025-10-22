//! Transport implementations for MCP protocol

use crate::{
    error::{McpError, Result},
    server::McpServer,
    types::{JsonRpcRequest, JsonRpcResponse},
};
use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::post,
    Router,
};
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tracing::{debug, error, info};

/// HTTP transport for MCP
pub struct HttpTransport {
    server: Arc<McpServer>,
    port: u16,
    path: String,
}

impl HttpTransport {
    /// Create a new HTTP transport
    pub fn new(server: Arc<McpServer>, port: u16, path: String) -> Self {
        Self { server, port, path }
    }

    /// Start the HTTP server
    pub async fn serve(self) -> Result<()> {
        let app = Router::new()
            .route(&self.path, post(handle_mcp_request))
            .route("/health", axum::routing::get(health_check))
            .with_state(self.server);

        let addr = format!("0.0.0.0:{}", self.port);
        info!("Starting MCP HTTP server on {}{}", addr, self.path);

        let listener = tokio::net::TcpListener::bind(&addr)
            .await
            .map_err(|e| McpError::TransportError(format!("Failed to bind to {}: {}", addr, e)))?;

        axum::serve(listener, app)
            .await
            .map_err(|e| McpError::TransportError(format!("Server error: {}", e)))?;

        Ok(())
    }
}

/// Handle MCP requests over HTTP
async fn handle_mcp_request(
    State(server): State<Arc<McpServer>>,
    Json(request): Json<JsonRpcRequest>,
) -> Result<Json<JsonRpcResponse>, StatusCode> {
    debug!("Received HTTP MCP request: {}", request.method);
    
    let response = server.handle_request(request).await;
    Ok(Json(response))
}

/// Health check endpoint
async fn health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "ok",
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}

/// STDIO transport for MCP
pub struct StdioTransport {
    server: Arc<McpServer>,
}

impl StdioTransport {
    /// Create a new STDIO transport
    pub fn new(server: Arc<McpServer>) -> Self {
        Self { server }
    }

    /// Start the STDIO server
    pub async fn serve(self) -> Result<()> {
        info!("Starting MCP STDIO server");

        let stdin = tokio::io::stdin();
        let mut stdout = tokio::io::stdout();
        let mut reader = BufReader::new(stdin);
        let mut line = String::new();

        loop {
            line.clear();
            match reader.read_line(&mut line).await {
                Ok(0) => {
                    debug!("EOF reached, shutting down");
                    break;
                }
                Ok(_) => {
                    let trimmed = line.trim();
                    if trimmed.is_empty() {
                        continue;
                    }

                    debug!("Received STDIO request: {}", trimmed);

                    match serde_json::from_str::<JsonRpcRequest>(trimmed) {
                        Ok(request) => {
                            let response = self.server.handle_request(request).await;
                            match serde_json::to_string(&response) {
                                Ok(response_json) => {
                                    if let Err(e) = stdout.write_all(response_json.as_bytes()).await {
                                        error!("Failed to write response: {}", e);
                                        break;
                                    }
                                    if let Err(e) = stdout.write_all(b"\n").await {
                                        error!("Failed to write newline: {}", e);
                                        break;
                                    }
                                    if let Err(e) = stdout.flush().await {
                                        error!("Failed to flush stdout: {}", e);
                                        break;
                                    }
                                }
                                Err(e) => {
                                    error!("Failed to serialize response: {}", e);
                                }
                            }
                        }
                        Err(e) => {
                            error!("Failed to parse request: {}", e);
                            let error_response = JsonRpcResponse {
                                jsonrpc: "2.0".to_string(),
                                id: None,
                                result: None,
                                error: Some(crate::types::JsonRpcError {
                                    code: -32700,
                                    message: "Parse error".to_string(),
                                    data: Some(serde_json::Value::String(e.to_string())),
                                }),
                            };
                            if let Ok(response_json) = serde_json::to_string(&error_response) {
                                let _ = stdout.write_all(response_json.as_bytes()).await;
                                let _ = stdout.write_all(b"\n").await;
                                let _ = stdout.flush().await;
                            }
                        }
                    }
                }
                Err(e) => {
                    error!("Failed to read from stdin: {}", e);
                    break;
                }
            }
        }

        Ok(())
    }
}