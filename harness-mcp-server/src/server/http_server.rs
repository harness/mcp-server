use anyhow::Result;
use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde_json::{json, Value};
use std::net::SocketAddr;
use tokio::net::TcpListener;
use tower::ServiceBuilder;
use tower_http::{
    cors::CorsLayer,
    trace::TraceLayer,
};
use tracing::{info, instrument};

use crate::{
    config::Config,
    error::AppError,
    middleware::tool_filtering::ToolFilteringMiddleware,
    auth::middleware::auth_middleware,
    server::mcp_handler::handle_mcp_request,
};

#[derive(Clone)]
pub struct HttpServerState {
    pub config: Config,
}

#[instrument(skip(config))]
pub async fn run(config: Config) -> Result<()> {
    let http_config = config.http_config.as_ref()
        .ok_or_else(|| anyhow::anyhow!("HTTP config not found"))?;
    
    let http_path = http_config.path.clone();
    let http_port = http_config.port;
    
    let state = HttpServerState { config };
    
    let app = Router::new()
        .route("/health", get(health_check))
        .route(&http_path, post(handle_mcp_request))
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(CorsLayer::permissive())
                .layer(axum::middleware::from_fn(auth_middleware))
        )
        .with_state(state);
    
    let addr = SocketAddr::from(([0, 0, 0, 0], http_port));
    let listener = TcpListener::bind(addr).await?;
    
    info!(
        port = http_port,
        path = http_path,
        "HTTP server listening"
    );
    
    axum::serve(listener, app).await?;
    
    Ok(())
}

async fn health_check() -> Result<Json<Value>, AppError> {
    Ok(Json(json!({
        "status": "healthy",
        "service": "harness-mcp-server"
    })))
}

