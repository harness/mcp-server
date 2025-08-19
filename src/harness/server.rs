use anyhow::Result;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader as AsyncBufReader};
use tracing::{debug, error, info, warn};

use crate::config::Config;
use crate::toolsets::ToolsetGroup;

pub struct HarnessServer {
    config: Config,
    toolsets: ToolsetGroup,
}

impl HarnessServer {
    pub async fn new(config: Config) -> Result<Self> {
        info!("Initializing Harness MCP Server");
        
        // Initialize toolsets based on configuration
        let toolsets = ToolsetGroup::new(&config).await?;
        
        Ok(Self { config, toolsets })
    }

    pub async fn run_stdio<R, W>(&self, reader: R, mut writer: W) -> Result<()>
    where
        R: std::io::Read + Send + 'static,
        W: std::io::Write + Send + 'static,
    {
        info!("Starting MCP server on stdio");

        let reader = BufReader::new(reader);
        
        for line in reader.lines() {
            let line = line?;
            if line.trim().is_empty() {
                continue;
            }

            debug!("Received: {}", line);

            match self.handle_request(&line).await {
                Ok(response) => {
                    let response_str = serde_json::to_string(&response)?;
                    debug!("Sending: {}", response_str);
                    writeln!(writer, "{}", response_str)?;
                    writer.flush()?;
                }
                Err(e) => {
                    error!("Error handling request: {}", e);
                    let error_response = json!({
                        "jsonrpc": "2.0",
                        "error": {
                            "code": -32603,
                            "message": "Internal error",
                            "data": e.to_string()
                        },
                        "id": null
                    });
                    let response_str = serde_json::to_string(&error_response)?;
                    writeln!(writer, "{}", response_str)?;
                    writer.flush()?;
                }
            }
        }

        Ok(())
    }

    async fn handle_request(&self, request: &str) -> Result<Value> {
        let request: Value = serde_json::from_str(request)?;
        
        let method = request["method"].as_str().unwrap_or("");
        let id = request["id"].clone();

        match method {
            "initialize" => self.handle_initialize(&request, id).await,
            "initialized" => self.handle_initialized(id).await,
            "tools/list" => self.handle_tools_list(id).await,
            "tools/call" => self.handle_tools_call(&request, id).await,
            "prompts/list" => self.handle_prompts_list(id).await,
            "prompts/get" => self.handle_prompts_get(&request, id).await,
            _ => {
                warn!("Unknown method: {}", method);
                Ok(json!({
                    "jsonrpc": "2.0",
                    "error": {
                        "code": -32601,
                        "message": "Method not found"
                    },
                    "id": id
                }))
            }
        }
    }

    async fn handle_initialize(&self, request: &Value, id: Value) -> Result<Value> {
        let params = &request["params"];
        let client_info = &params["clientInfo"];
        
        info!(
            "Client connected: {} v{}",
            client_info["name"].as_str().unwrap_or("unknown"),
            client_info["version"].as_str().unwrap_or("unknown")
        );

        Ok(json!({
            "jsonrpc": "2.0",
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {},
                    "prompts": {}
                },
                "serverInfo": {
                    "name": "harness-mcp-server",
                    "version": self.config.version
                }
            },
            "id": id
        }))
    }

    async fn handle_initialized(&self, id: Value) -> Result<Value> {
        info!("Client initialization completed");
        Ok(json!({
            "jsonrpc": "2.0",
            "result": {},
            "id": id
        }))
    }

    async fn handle_tools_list(&self, id: Value) -> Result<Value> {
        let tools = self.toolsets.list_tools().await?;
        
        Ok(json!({
            "jsonrpc": "2.0",
            "result": {
                "tools": tools
            },
            "id": id
        }))
    }

    async fn handle_tools_call(&self, request: &Value, id: Value) -> Result<Value> {
        let params = &request["params"];
        let name = params["name"].as_str().unwrap_or("");
        let arguments = params["arguments"].as_object().cloned().unwrap_or_default();

        match self.toolsets.call_tool(name, arguments).await {
            Ok(result) => Ok(json!({
                "jsonrpc": "2.0",
                "result": {
                    "content": [
                        {
                            "type": "text",
                            "text": result
                        }
                    ]
                },
                "id": id
            })),
            Err(e) => Ok(json!({
                "jsonrpc": "2.0",
                "error": {
                    "code": -32603,
                    "message": "Tool execution failed",
                    "data": e.to_string()
                },
                "id": id
            }))
        }
    }

    async fn handle_prompts_list(&self, id: Value) -> Result<Value> {
        // TODO: Implement prompts listing
        Ok(json!({
            "jsonrpc": "2.0",
            "result": {
                "prompts": []
            },
            "id": id
        }))
    }

    async fn handle_prompts_get(&self, _request: &Value, id: Value) -> Result<Value> {
        // TODO: Implement prompts get
        Ok(json!({
            "jsonrpc": "2.0",
            "result": {
                "description": "",
                "messages": []
            },
            "id": id
        }))
    }
}