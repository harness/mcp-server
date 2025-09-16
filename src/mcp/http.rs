use crate::config::HttpConfig;
use crate::error::Result;
use crate::mcp::{McpServer, JsonRpcRequest, JsonRpcResponse};
use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::post,
    Router,
};
use std::sync::Arc;
use tokio::net::TcpListener;
use tower::ServiceBuilder;
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use tracing::{info, error};

#[derive(Clone)]
pub struct HttpTransport {
    server: Arc<McpServer>,
}

impl HttpTransport {
    pub fn new(server: McpServer) -> Self {
        Self {
            server: Arc::new(server),
        }
    }

    pub async fn start(&self, port: u16, path: &str) -> Result<()> {
        let app = self.create_router(path);
        let addr = format!("0.0.0.0:{}", port);
        
        info!("Starting HTTP server on {}{}", addr, path);
        
        let listener = TcpListener::bind(&addr).await?;
        axum::serve(listener, app).await?;
        
        Ok(())
    }

    fn create_router(&self, path: &str) -> Router {
        use crate::mcp::middleware::{logging_middleware, cors_middleware, auth_middleware};
        
        let cors = CorsLayer::new()
            .allow_origin(Any)
            .allow_methods(Any)
            .allow_headers(Any);

        let middleware = ServiceBuilder::new()
            .layer(TraceLayer::new_for_http())
            .layer(cors)
            .layer(axum::middleware::from_fn(logging_middleware))
            .layer(axum::middleware::from_fn(cors_middleware))
            .layer(axum::middleware::from_fn(auth_middleware));

        Router::new()
            .route(path, post(handle_mcp_request))
            .route("/health", axum::routing::get(health_check))
            .layer(middleware)
            .with_state(self.server.clone())
    }
}

async fn handle_mcp_request(
    State(server): State<Arc<McpServer>>,
    Json(request): Json<JsonRpcRequest>,
) -> Result<Json<JsonRpcResponse>, StatusCode> {
    match server.handle_request(request).await {
        Ok(response) => Ok(Json(response)),
        Err(e) => {
            error!("Error handling MCP request: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "harness-mcp-server",
        "version": env!("CARGO_PKG_VERSION"),
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}

pub async fn run_http_server(config: HttpConfig) -> Result<()> {
    info!("Starting HTTP server on port {} at path {}", config.port, config.path);
    
    // Create HTTP client for Harness API calls
    let http_client = HttpClient::new("https://app.harness.io".to_string());
    
    // Create MCP server instance
    let mcp_server = McpServer::new();
    
    // Register tools with the server
    register_default_tools(&mcp_server, http_client).await;
    
    // Create HTTP transport
    let transport = HttpTransport::new(mcp_server);
    
    // Start the server
    transport.start(config.port, &config.path).await?;
    
    Ok(())
}

async fn register_default_tools(server: &McpServer, client: HttpClient) {
    use crate::tools::pipelines::{GetPipelineTool, ListPipelinesTool};
    use crate::tools::connectors::{GetConnectorDetailsTool, ListConnectorCatalogueTool, ListConnectorsTool};
    
    // Register pipeline tools
    server.register_tool("get_pipeline".to_string(), Box::new(GetPipelineTool::new(client.clone()))).await;
    server.register_tool("list_pipelines".to_string(), Box::new(ListPipelinesTool::new(client.clone()))).await;
    
    // Register connector tools
    server.register_tool("get_connector_details".to_string(), Box::new(GetConnectorDetailsTool::new(client.clone()))).await;
    server.register_tool("list_connector_catalogue".to_string(), Box::new(ListConnectorCatalogueTool::new(client.clone()))).await;
    server.register_tool("list_connectors".to_string(), Box::new(ListConnectorsTool::new(client))).await;
    
    info!("Registered {} tools with MCP server", 5);
}