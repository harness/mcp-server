//! HTTP transport server implementation

use anyhow::Result;
use axum::{
    extract::State,
    http::StatusCode,
    middleware,
    response::Json,
    routing::{get, post},
    Router,
};
use harness_mcp_config::Config;
use harness_mcp_core::{
    logging::{create_request_span, RequestContext},
    mcp::McpProtocol,
    types::{JsonRpcRequest, JsonRpcResponse},
};
use crate::{
    cli::HttpArgs, 
    middleware::{tracing_middleware, cors_middleware, error_handling_middleware},
    server::{create_mcp_server, create_protocol}
};
use std::sync::Arc;
use tokio::net::TcpListener;
use tracing::{info, error};
use uuid;

#[derive(Clone)]
struct AppState {
    protocol: Arc<McpProtocol>,
}

/// Run the HTTP server
pub async fn run(config: Config, args: HttpArgs) -> Result<()> {
    info!("Starting HTTP server");
    info!("Port: {}", args.port);
    info!("Path: {}", args.path);
    info!("Read-only mode: {}", config.server.read_only);
    
    // Create MCP server (no direct auth for HTTP mode, handled via headers)
    let mcp_server = create_mcp_server(&config, None, None).await?;
    
    // Create protocol handler
    let protocol = create_protocol(mcp_server, "harness-mcp-server-http");
    
    // Create app state
    let state = AppState { protocol };
    
    // Create router with middleware
    let app = Router::new()
        .route(&args.path, post(handle_mcp_request))
        .route("/health", get(health_check))
        .route("/", get(root_handler))
        .with_state(state)
        .layer(middleware::from_fn(error_handling_middleware))
        .layer(middleware::from_fn(cors_middleware))
        .layer(middleware::from_fn(tracing_middleware));
    
    // Start server
    let addr = format!("0.0.0.0:{}", args.port);
    let listener = TcpListener::bind(&addr).await?;
    info!("HTTP server listening on {}", addr);
    
    axum::serve(listener, app).await?;
    
    Ok(())
}

async fn handle_mcp_request(
    State(state): State<AppState>,
    Json(request): Json<JsonRpcRequest>,
) -> Result<Json<JsonRpcResponse>, StatusCode> {
    let request_id = uuid::Uuid::new_v4().to_string();
    let span = create_request_span("POST", "/mcp", &request_id);
    let _enter = span.enter();
    
    let start_time = std::time::Instant::now();
    
    tracing::info!(
        request_id = %request_id,
        method = %request.method,
        "Processing MCP request"
    );
    
    let result = match state.protocol.handle_request(request).await {
        Ok(response) => {
            let duration_ms = start_time.elapsed().as_millis() as u64;
            tracing::info!(
                request_id = %request_id,
                duration_ms = duration_ms,
                "MCP request completed successfully"
            );
            Ok(Json(response))
        }
        Err(e) => {
            let duration_ms = start_time.elapsed().as_millis() as u64;
            tracing::error!(
                request_id = %request_id,
                duration_ms = duration_ms,
                error = %e,
                "Error handling MCP request"
            );
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    };
    
    result
}

async fn health_check() -> &'static str {
    "OK"
}

async fn root_handler() -> &'static str {
    "Harness MCP Server - Use POST /mcp for MCP requests"
}