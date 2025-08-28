use anyhow::Result;
use log::{debug, info};
use std::io::{self, BufRead, BufReader, Write};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader as AsyncBufReader};

use crate::config::Config;
use crate::tools::ToolRegistry;

pub struct McpServer {
    config: Config,
    tool_registry: ToolRegistry,
}

impl McpServer {
    pub async fn new(config: Config) -> Result<Self> {
        info!("Initializing MCP Server with config: {:?}", config);
        
        let tool_registry = ToolRegistry::new(&config).await?;
        
        Ok(McpServer {
            config,
            tool_registry,
        })
    }

    pub async fn run_stdio(&self) -> Result<()> {
        info!("Starting MCP Server in stdio mode");
        
        let stdin = tokio::io::stdin();
        let mut stdout = tokio::io::stdout();
        let mut reader = AsyncBufReader::new(stdin);
        let mut line = String::new();

        // Send initial server info
        self.send_server_info(&mut stdout).await?;

        loop {
            line.clear();
            match reader.read_line(&mut line).await {
                Ok(0) => {
                    debug!("EOF reached, shutting down");
                    break;
                }
                Ok(_) => {
                    let trimmed = line.trim();
                    if !trimmed.is_empty() {
                        debug!("Received message: {}", trimmed);
                        
                        match self.handle_message(trimmed).await {
                            Ok(response) => {
                                if let Some(resp) = response {
                                    stdout.write_all(resp.as_bytes()).await?;
                                    stdout.write_all(b"\n").await?;
                                    stdout.flush().await?;
                                }
                            }
                            Err(e) => {
                                let error_response = self.create_error_response(&e);
                                stdout.write_all(error_response.as_bytes()).await?;
                                stdout.write_all(b"\n").await?;
                                stdout.flush().await?;
                            }
                        }
                    }
                }
                Err(e) => {
                    return Err(e.into());
                }
            }
        }

        Ok(())
    }

    async fn send_server_info(&self, stdout: &mut tokio::io::Stdout) -> Result<()> {
        let server_info = serde_json::json!({
            "jsonrpc": "2.0",
            "method": "server/info",
            "params": {
                "name": "harness-mcp-server",
                "version": self.config.version,
                "capabilities": {
                    "tools": true,
                    "prompts": true,
                    "resources": false
                }
            }
        });

        let info_str = serde_json::to_string(&server_info)?;
        stdout.write_all(info_str.as_bytes()).await?;
        stdout.write_all(b"\n").await?;
        stdout.flush().await?;
        
        Ok(())
    }

    async fn handle_message(&self, message: &str) -> Result<Option<String>> {
        // Parse JSON-RPC message
        let parsed: serde_json::Value = serde_json::from_str(message)?;
        
        debug!("Parsed message: {:?}", parsed);

        // Handle different MCP methods
        if let Some(method) = parsed.get("method").and_then(|m| m.as_str()) {
            match method {
                "initialize" => self.handle_initialize(&parsed).await,
                "tools/list" => self.handle_tools_list(&parsed).await,
                "tools/call" => self.handle_tools_call(&parsed).await,
                "prompts/list" => self.handle_prompts_list(&parsed).await,
                "prompts/get" => self.handle_prompts_get(&parsed).await,
                _ => {
                    debug!("Unknown method: {}", method);
                    Ok(None)
                }
            }
        } else {
            debug!("No method found in message");
            Ok(None)
        }
    }

    async fn handle_initialize(&self, request: &serde_json::Value) -> Result<Option<String>> {
        let response = serde_json::json!({
            "jsonrpc": "2.0",
            "id": request.get("id"),
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {
                        "listChanged": false
                    },
                    "prompts": {
                        "listChanged": false
                    }
                },
                "serverInfo": {
                    "name": "harness-mcp-server",
                    "version": self.config.version
                }
            }
        });

        Ok(Some(serde_json::to_string(&response)?))
    }

    async fn handle_tools_list(&self, request: &serde_json::Value) -> Result<Option<String>> {
        let tools = self.tool_registry.list_tools().await?;
        
        let response = serde_json::json!({
            "jsonrpc": "2.0",
            "id": request.get("id"),
            "result": {
                "tools": tools
            }
        });

        Ok(Some(serde_json::to_string(&response)?))
    }

    async fn handle_tools_call(&self, request: &serde_json::Value) -> Result<Option<String>> {
        let params = request.get("params").ok_or_else(|| {
            anyhow::anyhow!("Missing params in tools/call request")
        })?;

        let tool_name = params.get("name").and_then(|n| n.as_str()).ok_or_else(|| {
            anyhow::anyhow!("Missing tool name in tools/call request")
        })?;

        let arguments = params.get("arguments").unwrap_or(&serde_json::Value::Object(serde_json::Map::new()));

        let result = self.tool_registry.call_tool(tool_name, arguments).await?;

        let response = serde_json::json!({
            "jsonrpc": "2.0",
            "id": request.get("id"),
            "result": result
        });

        Ok(Some(serde_json::to_string(&response)?))
    }

    async fn handle_prompts_list(&self, request: &serde_json::Value) -> Result<Option<String>> {
        // For now, return empty prompts list
        let response = serde_json::json!({
            "jsonrpc": "2.0",
            "id": request.get("id"),
            "result": {
                "prompts": []
            }
        });

        Ok(Some(serde_json::to_string(&response)?))
    }

    async fn handle_prompts_get(&self, request: &serde_json::Value) -> Result<Option<String>> {
        // For now, return empty prompt
        let response = serde_json::json!({
            "jsonrpc": "2.0",
            "id": request.get("id"),
            "result": {
                "messages": []
            }
        });

        Ok(Some(serde_json::to_string(&response)?))
    }

    fn create_error_response(&self, error: &anyhow::Error) -> String {
        let error_response = serde_json::json!({
            "jsonrpc": "2.0",
            "error": {
                "code": -32603,
                "message": "Internal error",
                "data": error.to_string()
            }
        });

        serde_json::to_string(&error_response).unwrap_or_else(|_| {
            r#"{"jsonrpc":"2.0","error":{"code":-32603,"message":"Internal error"}}"#.to_string()
        })
    }
}