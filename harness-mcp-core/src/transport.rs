use crate::error::{McpError, Result};
use crate::mcp::JsonRpcMessage;
use crate::protocol::McpProtocolHandler;
use async_trait::async_trait;
use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::post,
    Router,
};
use serde_json::Value;
use std::io::{Read, Write};
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::Mutex;
use tower::ServiceBuilder;
use tower_http::{
    cors::CorsLayer,
    trace::TraceLayer,
};
use tracing::{debug, error, info};

#[async_trait]
pub trait Transport {
    async fn run(&mut self, protocol_handler: &mut McpProtocolHandler) -> Result<()>;
}

type SharedProtocolHandler = Arc<Mutex<McpProtocolHandler>>;

pub struct StdioTransport {
    // For stdio mode, we'll use tokio's stdin/stdout directly
}

impl StdioTransport {
    pub fn new<R: Read, W: Write>(_reader: R, _writer: W) -> Self {
        Self {}
    }
}

#[async_trait]
impl Transport for StdioTransport {
    async fn run(&mut self, protocol_handler: &mut McpProtocolHandler) -> Result<()> {
        info!("Starting stdio transport");
        
        use tokio::io::{BufReader, BufWriter};
        use tokio::io::AsyncBufReadExt;
        
        let stdin = tokio::io::stdin();
        let stdout = tokio::io::stdout();
        
        let mut reader = BufReader::new(stdin);
        let mut writer = BufWriter::new(stdout);
        
        let mut line = String::new();
        
        loop {
            line.clear();
            
            match reader.read_line(&mut line).await {
                Ok(0) => {
                    debug!("EOF reached, closing stdio transport");
                    break;
                }
                Ok(_) => {
                    let trimmed_line = line.trim();
                    
                    if trimmed_line.is_empty() {
                        continue;
                    }
                    
                    debug!("Received message: {}", trimmed_line);
                    
                    // Parse and handle the message
                    match self.handle_stdio_message(protocol_handler, trimmed_line).await {
                        Ok(Some(response)) => {
                            // Write response to stdout
                            let response_line = format!("{}\n", response);
                            if let Err(e) = writer.write_all(response_line.as_bytes()).await {
                                error!("Failed to write response: {}", e);
                                break;
                            }
                            if let Err(e) = writer.flush().await {
                                error!("Failed to flush stdout: {}", e);
                                break;
                            }
                        }
                        Ok(None) => {
                            // No response needed (notification)
                        }
                        Err(e) => {
                            error!("Error handling message: {}", e);
                            // Continue processing other messages
                        }
                    }
                }
                Err(e) => {
                    error!("Error reading from stdin: {}", e);
                    break;
                }
            }
        }
        
        info!("Stdio transport stopped");
        Ok(())
    }
}

impl StdioTransport {
    async fn handle_stdio_message(
        &self,
        protocol_handler: &mut McpProtocolHandler,
        line: &str,
    ) -> Result<Option<String>> {
        // Parse the JSON-RPC message
        let message = McpProtocolHandler::parse_message(line)?;
        
        // Handle the message
        let response = protocol_handler.handle_message(message).await?;
        
        if let Some(response_message) = response {
            let response_json = McpProtocolHandler::serialize_message(&response_message)?;
            Ok(Some(response_json))
        } else {
            Ok(None)
        }
    }
}

pub struct HttpTransport {
    port: u16,
    path: String,
}

impl HttpTransport {
    pub fn new(port: u16, path: String) -> Self {
        Self { port, path }
    }
}

#[async_trait]
impl Transport for HttpTransport {
    async fn run(&mut self, protocol_handler: &mut McpProtocolHandler) -> Result<()> {
        // Create a new protocol handler for HTTP mode
        let config = protocol_handler.config.clone();
        let tool_registry = protocol_handler.tool_registry.clone();
        let shared_handler = Arc::new(Mutex::new(
            McpProtocolHandler::new(config, tool_registry)
        ));

        let app = Router::new()
            .route(&self.path, post(handle_mcp_request))
            .route("/health", axum::routing::get(health_check))
            .layer(
                ServiceBuilder::new()
                    .layer(TraceLayer::new_for_http())
                    .layer(CorsLayer::permissive()),
            )
            .with_state(shared_handler);

        let addr = format!("0.0.0.0:{}", self.port);
        info!("HTTP server listening on {}{}", addr, self.path);

        let listener = tokio::net::TcpListener::bind(&addr)
            .await
            .map_err(|e| McpError::ServerError(format!("Failed to bind to {}: {}", addr, e)))?;

        axum::serve(listener, app)
            .await
            .map_err(|e| McpError::ServerError(format!("Server error: {}", e)))?;

        Ok(())
    }
}

async fn handle_mcp_request(
    State(handler): State<SharedProtocolHandler>,
    Json(payload): Json<Value>,
) -> Result<Json<Value>, StatusCode> {
    debug!("Received MCP request: {}", payload);

    // Parse the JSON-RPC message
    let message = McpProtocolHandler::parse_message(&payload.to_string())
        .map_err(|e| {
            error!("Failed to parse message: {}", e);
            StatusCode::BAD_REQUEST
        })?;

    // Handle the message
    let mut handler_guard = handler.lock().await;
    let response = handler_guard.handle_message(message).await
        .map_err(|e| {
            error!("Failed to handle message: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if let Some(response_message) = response {
        let response_json = McpProtocolHandler::serialize_message(&response_message)
            .map_err(|e| {
                error!("Failed to serialize response: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

        let response_value: Value = serde_json::from_str(&response_json)
            .map_err(|e| {
                error!("Failed to parse response JSON: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

        Ok(Json(response_value))
    } else {
        // No response for notifications
        Ok(Json(serde_json::json!({"status": "ok"})))
    }
}

async fn health_check() -> Json<Value> {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "harness-mcp-server"
    }))
}