use anyhow::Result;
use std::io;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tracing::{info, error, debug};

use crate::config::Config;
use crate::harness::tools::ToolRegistry;
use crate::modules::ModuleRegistry;
use crate::toolsets::ToolsetGroup;

pub struct HarnessServer {
    config: Config,
    tool_registry: ToolRegistry,
    module_registry: ModuleRegistry,
}

impl HarnessServer {
    pub async fn new(config: Config) -> Result<Self> {
        info!("Initializing Harness MCP Server");
        
        // Initialize tool registry
        let tool_registry = ToolRegistry::new(&config).await?;
        
        // Initialize module registry
        let module_registry = ModuleRegistry::new(&config)?;
        
        Ok(Self {
            config,
            tool_registry,
            module_registry,
        })
    }

    pub async fn run_stdio(&self) -> Result<()> {
        info!("Starting stdio server");
        
        let stdin = io::stdin();
        let mut stdout = io::stdout();
        let mut reader = BufReader::new(stdin);
        let mut line = String::new();

        loop {
            line.clear();
            match reader.read_line(&mut line).await {
                Ok(0) => {
                    debug!("EOF reached, shutting down");
                    break;
                }
                Ok(_) => {
                    debug!("Received line: {}", line.trim());
                    
                    // Process the JSON-RPC message
                    match self.process_message(&line).await {
                        Ok(response) => {
                            if let Some(resp) = response {
                                stdout.write_all(resp.as_bytes()).await?;
                                stdout.write_all(b"\n").await?;
                                stdout.flush().await?;
                            }
                        }
                        Err(e) => {
                            error!("Error processing message: {}", e);
                            // Send error response
                            let error_response = self.create_error_response(&e);
                            stdout.write_all(error_response.as_bytes()).await?;
                            stdout.write_all(b"\n").await?;
                            stdout.flush().await?;
                        }
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

    async fn process_message(&self, message: &str) -> Result<Option<String>> {
        // Parse JSON-RPC message
        let request: serde_json::Value = serde_json::from_str(message.trim())?;
        
        debug!("Processing request: {:?}", request);
        
        // Handle different MCP methods
        if let Some(method) = request.get("method").and_then(|m| m.as_str()) {
            match method {
                "initialize" => self.handle_initialize(&request).await,
                "tools/list" => self.handle_tools_list(&request).await,
                "tools/call" => self.handle_tools_call(&request).await,
                "prompts/list" => self.handle_prompts_list(&request).await,
                "prompts/get" => self.handle_prompts_get(&request).await,
                _ => {
                    debug!("Unknown method: {}", method);
                    Ok(None)
                }
            }
        } else {
            debug!("No method found in request");
            Ok(None)
        }
    }

    async fn handle_initialize(&self, request: &serde_json::Value) -> Result<Option<String>> {
        info!("Handling initialize request");
        
        let response = serde_json::json!({
            "jsonrpc": "2.0",
            "id": request.get("id"),
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
            }
        });

        Ok(Some(response.to_string()))
    }

    async fn handle_tools_list(&self, request: &serde_json::Value) -> Result<Option<String>> {
        debug!("Handling tools/list request");
        
        let tools = self.tool_registry.list_tools().await?;
        
        let response = serde_json::json!({
            "jsonrpc": "2.0",
            "id": request.get("id"),
            "result": {
                "tools": tools
            }
        });

        Ok(Some(response.to_string()))
    }

    async fn handle_tools_call(&self, request: &serde_json::Value) -> Result<Option<String>> {
        debug!("Handling tools/call request");
        
        let params = request.get("params")
            .ok_or_else(|| anyhow::anyhow!("Missing params in tools/call request"))?;
        
        let result = self.tool_registry.call_tool(params).await?;
        
        let response = serde_json::json!({
            "jsonrpc": "2.0",
            "id": request.get("id"),
            "result": result
        });

        Ok(Some(response.to_string()))
    }

    async fn handle_prompts_list(&self, request: &serde_json::Value) -> Result<Option<String>> {
        debug!("Handling prompts/list request");
        
        let prompts = self.module_registry.list_prompts().await?;
        
        let response = serde_json::json!({
            "jsonrpc": "2.0",
            "id": request.get("id"),
            "result": {
                "prompts": prompts
            }
        });

        Ok(Some(response.to_string()))
    }

    async fn handle_prompts_get(&self, request: &serde_json::Value) -> Result<Option<String>> {
        debug!("Handling prompts/get request");
        
        let params = request.get("params")
            .ok_or_else(|| anyhow::anyhow!("Missing params in prompts/get request"))?;
        
        let result = self.module_registry.get_prompt(params).await?;
        
        let response = serde_json::json!({
            "jsonrpc": "2.0",
            "id": request.get("id"),
            "result": result
        });

        Ok(Some(response.to_string()))
    }

    fn create_error_response(&self, error: &anyhow::Error) -> String {
        let response = serde_json::json!({
            "jsonrpc": "2.0",
            "id": null,
            "error": {
                "code": -32603,
                "message": "Internal error",
                "data": error.to_string()
            }
        });

        response.to_string()
    }
}