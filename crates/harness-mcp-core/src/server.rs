use crate::{McpError, Result};
use harness_mcp_auth::AuthProvider;
use harness_mcp_config::Config;
use harness_mcp_tools::ToolRegistry;
use std::io::{Read, Write};
use tracing::{debug, error, info};

pub struct McpServer {
    config: Config,
    tool_registry: ToolRegistry,
    auth_provider: AuthProvider,
}

impl McpServer {
    pub async fn new(config: Config) -> Result<Self> {
        info!("Initializing MCP Server with config: {:?}", config);

        // Initialize authentication provider
        let auth_provider = AuthProvider::new(&config).await?;

        // Initialize tool registry with enabled toolsets
        let tool_registry = ToolRegistry::new(&config, &auth_provider).await?;

        Ok(Self {
            config,
            tool_registry,
            auth_provider,
        })
    }

    pub async fn run_stdio<R: Read + Send + 'static, W: Write + Send + 'static>(
        &self,
        input: R,
        output: W,
    ) -> Result<()> {
        info!("Starting MCP server in stdio mode");

        // Create JSON-RPC server
        let mut io = jsonrpc_core::IoHandler::new();

        // Register MCP methods
        self.register_mcp_methods(&mut io).await?;

        // Start stdio server
        let server = jsonrpc_stdio_server::ServerBuilder::new(io).build();

        server
            .start(input, output)
            .await
            .map_err(|e| McpError::Internal(format!("Stdio server error: {}", e)))?;

        Ok(())
    }

    pub async fn run_http(&self) -> Result<()> {
        info!(
            "Starting MCP server in HTTP mode on port {}",
            self.config.http_port
        );

        // Create axum router
        let app = self.create_http_router().await?;

        // Create listener
        let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", self.config.http_port))
            .await
            .map_err(|e| McpError::Internal(format!("Failed to bind to port: {}", e)))?;

        info!(
            "HTTP server listening on {}",
            listener.local_addr().unwrap()
        );

        // Start server
        axum::serve(listener, app)
            .await
            .map_err(|e| McpError::Internal(format!("HTTP server error: {}", e)))?;

        Ok(())
    }

    async fn register_mcp_methods(&self, io: &mut jsonrpc_core::IoHandler) -> Result<()> {
        // Register initialize method
        let config = self.config.clone();
        io.add_method("initialize", move |params| {
            let config = config.clone();
            async move {
                info!("Client initializing MCP connection");

                // Parse initialize request
                let _request: serde_json::Value = params.parse()?;

                // Return server capabilities
                Ok(serde_json::json!({
                    "protocolVersion": "2024-11-05",
                    "capabilities": {
                        "tools": {},
                        "resources": {
                            "subscribe": true,
                            "listChanged": true
                        },
                        "prompts": {},
                        "logging": {}
                    },
                    "serverInfo": {
                        "name": "harness-mcp-server",
                        "version": env!("CARGO_PKG_VERSION")
                    }
                }))
            }
        });

        // Register tools/list method
        let tool_registry = self.tool_registry.clone();
        io.add_method("tools/list", move |_params| {
            let tool_registry = tool_registry.clone();
            async move {
                let tools = tool_registry.list_tools().await.map_err(|e| {
                    jsonrpc_core::Error::internal_error()
                })?;
                Ok(serde_json::json!({
                    "tools": tools
                }))
            }
        });

        // Register tools/call method
        let tool_registry = self.tool_registry.clone();
        io.add_method("tools/call", move |params| {
            let tool_registry = tool_registry.clone();
            async move {
                let request: serde_json::Value = params.parse()?;
                let result = tool_registry.call_tool(request).await?;
                Ok(result)
            }
        });

        // Register resources/list method
        io.add_method("resources/list", move |_params| async move {
            Ok(serde_json::json!({
                "resources": []
            }))
        });

        // Register prompts/list method
        io.add_method("prompts/list", move |_params| async move {
            Ok(serde_json::json!({
                "prompts": []
            }))
        });

        info!("Registered MCP methods");
        Ok(())
    }

    async fn create_http_router(&self) -> Result<axum::Router> {
        use axum::{
            extract::State,
            http::{HeaderMap, StatusCode},
            response::Json,
            routing::post,
            Router,
        };
        use tower_http::cors::{Any, CorsLayer};

        // Clone necessary data for the router
        let tool_registry = self.tool_registry.clone();
        let config = self.config.clone();

        // Create shared state
        let app_state = AppState {
            tool_registry,
            config,
        };

        // Create router with MCP endpoints
        let app = Router::new()
            .route(&self.config.http_path, post(handle_mcp_request))
            .route("/health", axum::routing::get(health_check))
            .layer(
                CorsLayer::new()
                    .allow_origin(Any)
                    .allow_methods(Any)
                    .allow_headers(Any),
            )
            .with_state(app_state);

        Ok(app)
    }
}

#[derive(Clone)]
struct AppState {
    tool_registry: ToolRegistry,
    config: Config,
}

async fn handle_mcp_request(
    axum::extract::State(state): axum::extract::State<AppState>,
    headers: axum::http::HeaderMap,
    axum::Json(payload): axum::Json<serde_json::Value>,
) -> std::result::Result<axum::Json<serde_json::Value>, axum::http::StatusCode> {
    use tracing::{debug, error};

    debug!("Received MCP request: {:?}", payload);

    // Extract method from JSON-RPC request
    let method = payload["method"].as_str().ok_or(axum::http::StatusCode::BAD_REQUEST)?;

    let params = payload["params"].clone();
    let id = payload["id"].clone();

    // Handle different MCP methods
    let result = match method {
        "initialize" => handle_initialize(&state, params).await,
        "tools/list" => handle_tools_list(&state).await,
        "tools/call" => handle_tools_call(&state, params).await,
        "resources/list" => handle_resources_list().await,
        "prompts/list" => handle_prompts_list().await,
        _ => {
            error!("Unknown method: {}", method);
            return Err(axum::http::StatusCode::METHOD_NOT_ALLOWED);
        }
    };

    match result {
        Ok(response) => {
            let json_rpc_response = serde_json::json!({
                "jsonrpc": "2.0",
                "id": id,
                "result": response
            });
            Ok(axum::Json(json_rpc_response))
        }
        Err(e) => {
            error!("Error handling request: {}", e);
            let error_response = serde_json::json!({
                "jsonrpc": "2.0",
                "id": id,
                "error": {
                    "code": e.error_code(),
                    "message": e.to_string(),
                    "data": {
                        "method": method,
                        "retryable": e.is_retryable(),
                        "error_type": match e {
                            McpError::Auth(_) => "authentication",
                            McpError::Config(_) => "configuration",
                            McpError::Tool(_) => "tool_execution",
                            McpError::Client(_) => "client",
                            McpError::InvalidRequest(_) => "invalid_request",
                            McpError::MethodNotFound(_) => "method_not_found",
                            McpError::Parse(_) => "parse_error",
                            _ => "internal_error"
                        }
                    }
                }
            });
            Ok(axum::Json(error_response))
        }
    }
}

async fn handle_initialize(
    _state: &AppState,
    _params: serde_json::Value,
) -> Result<serde_json::Value> {
    info!("Client initializing MCP connection");

    Ok(serde_json::json!({
        "protocolVersion": "2024-11-05",
        "capabilities": {
            "tools": {},
            "resources": {
                "subscribe": true,
                "listChanged": true
            },
            "prompts": {},
            "logging": {}
        },
        "serverInfo": {
            "name": "harness-mcp-server",
            "version": env!("CARGO_PKG_VERSION")
        }
    }))
}

async fn handle_tools_list(state: &AppState) -> Result<serde_json::Value> {
    let tools = state
        .tool_registry
        .list_tools()
        .await
        .map_err(|e| McpError::Tool(e))?;

    Ok(serde_json::json!({
        "tools": tools
    }))
}

async fn handle_tools_call(
    state: &AppState,
    params: serde_json::Value,
) -> Result<serde_json::Value> {
    let result = state
        .tool_registry
        .call_tool(params)
        .await
        .map_err(|e| McpError::Tool(e))?;

    Ok(result)
}

async fn handle_resources_list() -> Result<serde_json::Value> {
    Ok(serde_json::json!({
        "resources": []
    }))
}

async fn handle_prompts_list() -> Result<serde_json::Value> {
    Ok(serde_json::json!({
        "prompts": []
    }))
}

async fn health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "healthy",
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}
