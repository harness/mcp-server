//! MCP server implementation

use crate::{config::Config, Error, Result};
use axum::{
    extract::State,
    response::Json,
    routing::{get, post},
    Router,
};
use std::sync::Arc;
use tokio::net::TcpListener;
use tracing::info;

/// MCP Server implementation
pub struct McpServer {
    config: Arc<Config>,
    // TODO: Add tool registry, auth middleware, etc.
}

impl McpServer {
    /// Create a new MCP server
    pub async fn new(config: Config) -> Result<Self> {
        config.validate()?;

        Ok(Self {
            config: Arc::new(config),
        })
    }

    /// Run the server in stdio mode
    pub async fn run_stdio<R, W>(&self, _reader: R, _writer: W) -> Result<()>
    where
        R: tokio::io::AsyncRead + Unpin,
        W: tokio::io::AsyncWrite + Unpin,
    {
        info!("Starting MCP server in stdio mode");

        // TODO: Implement stdio MCP protocol handling
        // This would involve:
        // 1. Reading JSON-RPC messages from stdin
        // 2. Processing MCP protocol messages
        // 3. Executing tools and returning responses
        // 4. Writing JSON-RPC responses to stdout

        // For now, just log that we're running
        info!("Stdio server is running (placeholder implementation)");

        // Keep the server running
        tokio::signal::ctrl_c()
            .await
            .map_err(|e| Error::internal(format!("Signal handling error: {}", e)))?;

        Ok(())
    }

    /// Run the server in HTTP mode
    pub async fn run_http(&self) -> Result<()> {
        info!(
            "Starting MCP server in HTTP mode on port {}",
            self.config.http_port
        );

        let app = self.create_http_router();

        let addr = format!("0.0.0.0:{}", self.config.http_port);
        let listener = TcpListener::bind(&addr)
            .await
            .map_err(|e| Error::internal(format!("Failed to bind to {}: {}", addr, e)))?;

        info!("HTTP server listening on {}", addr);

        axum::serve(listener, app)
            .await
            .map_err(|e| Error::internal(format!("HTTP server error: {}", e)))?;

        Ok(())
    }

    /// Create the HTTP router
    fn create_http_router(&self) -> Router {
        Router::new()
            .route("/health", get(health_check))
            .route(&self.config.http_path, post(handle_mcp_request))
            .with_state(self.config.clone())
    }
}

/// Health check endpoint
async fn health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "harness-mcp-server"
    }))
}

/// Handle MCP requests over HTTP
async fn handle_mcp_request(
    State(_config): State<Arc<Config>>,
    Json(_payload): Json<serde_json::Value>,
) -> Json<serde_json::Value> {
    // TODO: Implement MCP protocol handling over HTTP
    // This would involve:
    // 1. Parsing the JSON-RPC request
    // 2. Processing MCP protocol messages
    // 3. Executing tools and returning responses
    // 4. Returning JSON-RPC responses

    // For now, return a placeholder response
    Json(serde_json::json!({
        "jsonrpc": "2.0",
        "result": {
            "status": "MCP server is running (placeholder implementation)"
        },
        "id": 1
    }))
}
