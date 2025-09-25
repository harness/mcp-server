//! Internal transport server implementation

use anyhow::Result;
use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use harness_mcp_config::Config;
use harness_mcp_core::{
    mcp::McpProtocol,
    types::{JsonRpcRequest, JsonRpcResponse},
};
use crate::{cli::InternalArgs, server::{create_mcp_server, create_protocol}};
use std::sync::Arc;
use tokio::net::TcpListener;
use tracing::{info, error};

#[derive(Clone)]
struct AppState {
    protocol: Arc<McpProtocol>,
}

/// Run the internal server
pub async fn run(config: Config, args: InternalArgs) -> Result<()> {
    info!("Starting internal server");
    info!("Bearer token provided: {}", !args.bearer_token.is_empty());
    info!("MCP service secret provided: {}", !args.mcp_svc_secret.is_empty());
    info!("Read-only mode: {}", config.server.read_only);
    
    // Create MCP server with bearer token authentication
    let mcp_server = create_mcp_server(&config, None, Some(args.bearer_token)).await?;
    
    // Create protocol handler
    let protocol = create_protocol(mcp_server, "harness-mcp-server-internal");
    
    // Create app state
    let state = AppState { protocol };
    
    // Create router with internal endpoints
    let app = Router::new()
        .route("/internal/mcp", post(handle_mcp_request))
        .route("/internal/health", get(health_check))
        .route("/internal", get(root_handler))
        .with_state(state);
    
    // Start server on internal port
    let addr = "127.0.0.1:8081";
    let listener = TcpListener::bind(addr).await?;
    info!("Internal server listening on {}", addr);
    
    axum::serve(listener, app).await?;
    
    Ok(())
}

async fn handle_mcp_request(
    State(state): State<AppState>,
    Json(request): Json<JsonRpcRequest>,
) -> Result<Json<JsonRpcResponse>, StatusCode> {
    match state.protocol.handle_request(request).await {
        Ok(response) => Ok(Json(response)),
        Err(e) => {
            error!("Error handling MCP request: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn health_check() -> &'static str {
    "OK"
}

async fn root_handler() -> &'static str {
    "Harness MCP Server - Internal Mode - Use POST /internal/mcp for MCP requests"
}