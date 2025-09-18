use crate::config::Config;
use crate::error::{HarnessError, Result};
use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde_json::{json, Value};
use std::net::SocketAddr;
use tokio::signal;
use tower::ServiceBuilder;
use tower_http::{cors::CorsLayer, trace::TraceLayer, timeout::TimeoutLayer};
use tracing::{info, warn};

/// HTTP server state
#[derive(Clone)]
pub struct AppState {
    pub config: Config,
}

/// Health check endpoint
async fn health() -> Json<Value> {
    Json(json!({
        "status": "healthy",
        "service": "harness-mcp-server"
    }))
}

/// MCP endpoint handler (placeholder)
async fn mcp_handler(State(_state): State<AppState>) -> std::result::Result<Json<Value>, StatusCode> {
    // TODO: Implement MCP protocol handling
    Ok(Json(json!({
        "jsonrpc": "2.0",
        "error": {
            "code": -32601,
            "message": "Method not implemented"
        }
    })))
}

/// Create the HTTP router
fn create_router(config: Config) -> Router {
    let state = AppState { config: config.clone() };

    let app = Router::new()
        .route("/health", get(health))
        .route(&config.http_path, post(mcp_handler))
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(CorsLayer::permissive())
                .layer(TimeoutLayer::new(std::time::Duration::from_secs(30)))
        )
        .with_state(state);

    app
}

/// Run the HTTP server
pub async fn run_server(config: Config) -> Result<()> {
    let addr = SocketAddr::from(([0, 0, 0, 0], config.http_port));
    
    info!(
        "Starting HTTP server on {} with path {}",
        addr, config.http_path
    );

    let app = create_router(config);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|e| HarnessError::server(format!("Failed to bind to {}: {}", addr, e)))?;

    info!("HTTP server listening on {}", addr);

    // Run the server with graceful shutdown
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .map_err(|e| HarnessError::server(format!("Server error: {}", e)))?;

    info!("HTTP server shut down gracefully");
    Ok(())
}

/// Wait for shutdown signal
async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {
            info!("Received Ctrl+C signal");
        },
        _ = terminate => {
            info!("Received terminate signal");
        },
    }

    warn!("Shutting down HTTP server...");
}