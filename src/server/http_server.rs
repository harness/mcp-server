use crate::config::Config;
use crate::error::Result;
use crate::mcp::{JsonRpcRequest, server::McpServer};
use crate::tools;
use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde_json::{json, Value};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::Mutex;
use tower::ServiceBuilder;
use tower_http::{
    cors::CorsLayer,
    trace::TraceLayer,
};
use tracing::{info, debug, error};

/// Application state
#[derive(Clone)]
pub struct AppState {
    pub config: Config,
    pub mcp_server: Arc<Mutex<McpServer>>,
}

/// Run the MCP server with HTTP transport
pub async fn run(config: Config) -> Result<()> {
    info!("Starting HTTP server with config: {:?}", config);
    
    // Initialize tools
    let tool_registry = tools::init_tools(&config)?;
    
    // Create MCP server
    let mcp_server = McpServer::new(config.clone(), tool_registry);
    
    let state = AppState { 
        config: config.clone(),
        mcp_server: Arc::new(Mutex::new(mcp_server)),
    };
    
    // Build the router
    let app = Router::new()
        .route("/health", get(health_check))
        .route(&config.http_path, post(mcp_handler))
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(CorsLayer::permissive())
        )
        .with_state(state);
    
    // Start the server
    let addr = SocketAddr::from(([0, 0, 0, 0], config.http_port));
    info!("Harness MCP Server listening on http://{}{}", addr, config.http_path);
    
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    
    Ok(())
}

/// Health check endpoint
async fn health_check(State(state): State<AppState>) -> Json<Value> {
    Json(json!({
        "status": "healthy",
        "version": state.config.version,
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}

/// MCP protocol handler
async fn mcp_handler(
    State(state): State<AppState>,
    Json(payload): Json<Value>,
) -> Result<Json<Value>, StatusCode> {
    debug!("Received MCP request: {:?}", payload);
    
    // Parse JSON-RPC request
    let request: JsonRpcRequest = match serde_json::from_value(payload) {
        Ok(req) => req,
        Err(e) => {
            error!("Failed to parse JSON-RPC request: {}", e);
            return Err(StatusCode::BAD_REQUEST);
        }
    };
    
    // Handle request with MCP server
    let mut mcp_server = state.mcp_server.lock().await;
    let response = mcp_server.handle_request(request).await;
    
    // Convert response to JSON
    match serde_json::to_value(response) {
        Ok(json_response) => Ok(Json(json_response)),
        Err(e) => {
            error!("Failed to serialize MCP response: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}