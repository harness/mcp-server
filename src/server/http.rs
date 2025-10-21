use crate::config::Config;
use crate::error::{HarnessError, Result};
use crate::server::create_mcp_server;
use axum::{
    extract::{Request, State},
    http::{HeaderMap, StatusCode, Method},
    middleware::{self, Next},
    response::{Json, Response},
    routing::{get, post},
    Router,
};
use serde_json::{json, Value};
use std::sync::Arc;
use tokio::net::TcpListener;
use tower::ServiceBuilder;
use tower_http::{
    cors::{CorsLayer, Any},
    trace::{TraceLayer, DefaultMakeSpan, DefaultOnResponse},
    timeout::TimeoutLayer,
    limit::RequestBodyLimitLayer,
    compression::CompressionLayer,
    validate_request::ValidateRequestHeaderLayer,
};
use tracing::{info, error, warn, Level};
use chrono;
use std::time::Duration;

#[derive(Clone)]
struct AppState {
    server: Arc<crate::mcp::McpServer>,
    config: Config,
}

pub async fn run(config: Config) -> Result<()> {
    info!("Starting HTTP MCP server on port {}", config.http_port);
    
    let server = create_mcp_server(&config)?;
    let state = AppState {
        server: Arc::new(server),
        config: config.clone(),
    };
    
    // Create CORS layer with appropriate settings
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers(Any)
        .max_age(Duration::from_secs(3600));
    
    // Create tracing layer
    let trace = TraceLayer::new_for_http()
        .make_span_with(DefaultMakeSpan::new().level(Level::INFO))
        .on_response(DefaultOnResponse::new().level(Level::INFO));
    
    let app = Router::new()
        // Health check endpoint
        .route("/health", get(health_check))
        // MCP endpoint
        .route(&config.http_path, post(handle_mcp_request))
        // Add middleware
        .layer(
            ServiceBuilder::new()
                .layer(trace)
                .layer(cors)
                .layer(CompressionLayer::new())
                .layer(TimeoutLayer::new(Duration::from_secs(30)))
                .layer(RequestBodyLimitLayer::new(1024 * 1024)) // 1MB limit
                .layer(middleware::from_fn(request_logging_middleware))
        )
        .with_state(state);
    
    let addr = format!("0.0.0.0:{}", config.http_port);
    let listener = TcpListener::bind(&addr).await?;
    
    info!("HTTP server listening on {}{}", addr, config.http_path);
    info!("Health check available at: http://{}/health", addr);
    
    axum::serve(listener, app).await?;
    
    Ok(())
}

async fn health_check() -> Json<Value> {
    Json(json!({
        "status": "healthy",
        "service": "harness-mcp-server",
        "version": env!("CARGO_PKG_VERSION"),
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}

async fn request_logging_middleware(
    request: Request,
    next: Next,
) -> Response {
    let method = request.method().clone();
    let uri = request.uri().clone();
    let start = std::time::Instant::now();
    
    let response = next.run(request).await;
    
    let duration = start.elapsed();
    let status = response.status();
    
    info!(
        "HTTP {} {} {} {:?}",
        method,
        uri,
        status.as_u16(),
        duration
    );
    
    response
}

async fn handle_mcp_request(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<Value>,
) -> Result<Json<Value>, (StatusCode, String)> {
    // Log the request
    tracing::debug!("Received HTTP MCP request: {}", request);
    
    // Validate content type
    if let Some(content_type) = headers.get("content-type") {
        if !content_type.to_str().unwrap_or("").contains("application/json") {
            warn!("Invalid content type: {:?}", content_type);
            return Err((
                StatusCode::BAD_REQUEST,
                "Content-Type must be application/json".to_string(),
            ));
        }
    }
    
    // Process the request
    match state.server.handle_request(request).await {
        Ok(response) => {
            tracing::debug!("Sending HTTP MCP response: {}", response);
            Ok(Json(response))
        }
        Err(e) => {
            error!("Error processing HTTP MCP request: {}", e);
            
            let (status_code, error_message) = match &e {
                HarnessError::Auth(_) => (StatusCode::UNAUTHORIZED, "Authentication failed"),
                HarnessError::InvalidParameter(_) | HarnessError::MissingParameter(_) => {
                    (StatusCode::BAD_REQUEST, "Invalid request parameters")
                }
                HarnessError::Api(msg) if msg.contains("not found") => {
                    (StatusCode::NOT_FOUND, "Resource not found")
                }
                HarnessError::Api(msg) if msg.contains("forbidden") => {
                    (StatusCode::FORBIDDEN, "Access forbidden")
                }
                _ => (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error"),
            };
            
            Err((status_code, format!("{}: {}", error_message, e)))
        }
    }
}