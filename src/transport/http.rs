use crate::auth::{auth_middleware, AuthState};
use crate::error::Result;
use crate::mcp::{JsonRpcRequest, JsonRpcResponse, McpServer};
use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    middleware,
    response::{IntoResponse, Json},
    routing::post,
    Router,
};
use std::sync::Arc;
use tokio::net::TcpListener;
use tower::ServiceBuilder;
use tower_http::{
    cors::{Any, CorsLayer},
    timeout::TimeoutLayer,
    trace::TraceLayer,
};
use tracing::{info, warn};

#[derive(Clone)]
pub struct HttpTransportState {
    server: Arc<McpServer>,
}

impl HttpTransportState {
    pub fn new(server: McpServer) -> Self {
        Self {
            server: Arc::new(server),
        }
    }
}

pub struct HttpTransport {
    server: McpServer,
    port: u16,
    path: String,
    auth_state: AuthState,
}

impl HttpTransport {
    pub fn new(server: McpServer, port: u16, path: String, auth_state: AuthState) -> Self {
        Self {
            server,
            port,
            path,
            auth_state,
        }
    }
    
    pub async fn run(&self) -> Result<()> {
        let app_state = HttpTransportState::new(self.server.clone());
        
        let app = Router::new()
            .route(&self.path, post(handle_mcp_request))
            .layer(
                ServiceBuilder::new()
                    .layer(TraceLayer::new_for_http())
                    .layer(CorsLayer::new().allow_origin(Any).allow_headers(Any).allow_methods(Any))
                    .layer(TimeoutLayer::new(std::time::Duration::from_secs(30)))
                    .layer(middleware::from_fn_with_state(
                        self.auth_state.clone(),
                        auth_middleware,
                    )),
            )
            .with_state(app_state)
            .with_state(self.auth_state.clone());
        
        let addr = format!("0.0.0.0:{}", self.port);
        info!("Starting HTTP server on {} with path {}", addr, self.path);
        
        let listener = TcpListener::bind(&addr).await?;
        axum::serve(listener, app).await?;
        
        Ok(())
    }
}

async fn handle_mcp_request(
    State(state): State<HttpTransportState>,
    _headers: HeaderMap,
    Json(request): Json<JsonRpcRequest>,
) -> impl IntoResponse {
    match state.server.handle_request(request).await {
        Ok(response) => Json(response).into_response(),
        Err(e) => {
            warn!("Error handling MCP request: {}", e);
            
            let error_response = JsonRpcResponse::error(
                None,
                crate::mcp::JsonRpcError::new(-32603, e.to_string()),
            );
            
            Json(error_response).into_response()
        }
    }
}