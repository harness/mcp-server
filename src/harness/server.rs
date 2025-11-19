use anyhow::Result;
use axum::{extract::State, response::Json, routing::{get, post}, Router};
use std::{io, sync::Arc};
use tokio::io::{stdin, stdout, AsyncBufReadExt, AsyncWriteExt, BufReader};
use tracing::{info, error};

use crate::config::Config;
use crate::toolsets::ToolsetGroup;
use crate::modules::ModuleRegistry;

pub struct HarnessServer {
    config: Config,
    toolsets: ToolsetGroup,
    module_registry: ModuleRegistry,
}

impl HarnessServer {
    pub async fn new(config: Config) -> Result<Self> {
        info!("Initializing Harness MCP Server");
        
        // Initialize toolsets
        let toolsets = ToolsetGroup::new(config.read_only);
        
        // Initialize module registry
        let module_registry = ModuleRegistry::new(&config, &toolsets);
        
        Ok(Self {
            config,
            toolsets,
            module_registry,
        })
    }

    pub async fn run_stdio(&self) -> Result<()> {
        info!("Starting stdio server");
        
        let stdin = stdin();
        let mut stdout = stdout();
        let mut reader = BufReader::new(stdin);
        let mut line = String::new();

        loop {
            line.clear();
            match reader.read_line(&mut line).await {
                Ok(0) => break, // EOF
                Ok(_) => {
                    // Process MCP JSON-RPC message
                    if let Err(e) = self.process_message(&line, &mut stdout).await {
                        error!("Error processing message: {}", e);
                    }
                }
                Err(e) => {
                    error!("Error reading from stdin: {}", e);
                    break;
                }
            }
        }

        Ok(())
    }

    pub async fn run_http(&self) -> Result<()> {
        info!("Starting HTTP server on port {}", self.config.http_port);
        
        use serde_json::json;

        let app_state = Arc::new(self.clone());

        let app = Router::new()
            .route("/health", get(health_check))
            .route(&self.config.http_path, post(handle_mcp_request))
            .with_state(app_state);

        let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", self.config.http_port)).await?;
        
        info!("HTTP server listening on {}", listener.local_addr()?);
        axum::serve(listener, app).await?;

        Ok(())
    }

    async fn process_message(&self, message: &str, stdout: &mut tokio::io::Stdout) -> Result<()> {
        // Parse JSON-RPC message
        let request: serde_json::Value = serde_json::from_str(message.trim())?;
        
        // Process the request and generate response
        let response = self.handle_mcp_request(request).await?;
        
        // Write response to stdout
        let response_str = serde_json::to_string(&response)?;
        stdout.write_all(response_str.as_bytes()).await?;
        stdout.write_all(b"\n").await?;
        stdout.flush().await?;
        
        Ok(())
    }

    async fn handle_mcp_request(&self, request: serde_json::Value) -> Result<serde_json::Value> {
        use serde_json::json;

        // Extract method from JSON-RPC request
        let method = request.get("method")
            .and_then(|m| m.as_str())
            .unwrap_or("");

        match method {
            "initialize" => {
                Ok(json!({
                    "jsonrpc": "2.0",
                    "id": request.get("id"),
                    "result": {
                        "protocolVersion": "2024-11-05",
                        "capabilities": {
                            "tools": {},
                            "resources": {
                                "subscribe": true,
                                "listChanged": true
                            },
                            "prompts": {}
                        },
                        "serverInfo": {
                            "name": "harness-mcp-server",
                            "version": self.config.version
                        }
                    }
                }))
            }
            "tools/list" => {
                // Return list of available tools
                Ok(json!({
                    "jsonrpc": "2.0",
                    "id": request.get("id"),
                    "result": {
                        "tools": []
                    }
                }))
            }
            "tools/call" => {
                // Handle tool execution
                Ok(json!({
                    "jsonrpc": "2.0",
                    "id": request.get("id"),
                    "result": {
                        "content": [
                            {
                                "type": "text",
                                "text": "Tool execution not yet implemented"
                            }
                        ]
                    }
                }))
            }
            _ => {
                Ok(json!({
                    "jsonrpc": "2.0",
                    "id": request.get("id"),
                    "error": {
                        "code": -32601,
                        "message": "Method not found"
                    }
                }))
            }
        }
    }
}

impl Clone for HarnessServer {
    fn clone(&self) -> Self {
        Self {
            config: self.config.clone(),
            toolsets: self.toolsets.clone(),
            module_registry: self.module_registry.clone(),
        }
    }
}

async fn health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({"status": "ok"}))
}

async fn handle_mcp_request(
    State(server): State<Arc<HarnessServer>>,
    Json(request): Json<serde_json::Value>,
) -> Json<serde_json::Value> {
    match server.handle_mcp_request(request).await {
        Ok(response) => Json(response),
        Err(e) => {
            error!("Error handling MCP request: {}", e);
            Json(serde_json::json!({
                "jsonrpc": "2.0",
                "error": {
                    "code": -32603,
                    "message": "Internal error"
                }
            }))
        }
    }
}