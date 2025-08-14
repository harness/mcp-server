use crate::{Error, Result};
use harness_config::Config;
use harness_auth::AuthManager;
use harness_tools::ToolsetManager;
use std::sync::Arc;
use tokio::io::{self, AsyncBufReadExt, AsyncWriteExt, BufReader};
use tracing::{info, error, debug};

/// Main MCP server implementation
pub struct Server {
    config: Arc<Config>,
    auth_manager: Arc<AuthManager>,
    toolset_manager: Arc<ToolsetManager>,
}

impl Server {
    /// Create a new server instance
    pub async fn new(config: Config) -> Result<Self> {
        // Validate configuration
        config.validate()?;
        
        let config = Arc::new(config);
        
        // Initialize authentication manager
        let auth_manager = Arc::new(AuthManager::new(config.clone()).await?);
        
        // Initialize toolset manager
        let toolset_manager = Arc::new(ToolsetManager::new(config.clone()).await?);
        
        Ok(Self {
            config,
            auth_manager,
            toolset_manager,
        })
    }
    
    /// Run the server
    pub async fn run(&self) -> Result<()> {
        info!("Starting Harness MCP Server");
        
        // Setup stdio communication
        let stdin = io::stdin();
        let mut stdout = io::stdout();
        let mut reader = BufReader::new(stdin);
        let mut line = String::new();
        
        // Send server info
        self.send_server_info(&mut stdout).await?;
        
        // Main message loop
        loop {
            line.clear();
            
            match reader.read_line(&mut line).await {
                Ok(0) => {
                    // EOF reached
                    debug!("EOF reached, shutting down");
                    break;
                }
                Ok(_) => {
                    if let Err(e) = self.handle_message(&line, &mut stdout).await {
                        error!("Error handling message: {}", e);
                        self.send_error_response(&mut stdout, &e).await?;
                    }
                }
                Err(e) => {
                    error!("Error reading from stdin: {}", e);
                    return Err(Error::Io(e));
                }
            }
        }
        
        info!("Server shutdown complete");
        Ok(())
    }
    
    /// Send server information
    async fn send_server_info(&self, stdout: &mut io::Stdout) -> Result<()> {
        let server_info = serde_json::json!({
            "jsonrpc": "2.0",
            "method": "notifications/initialized",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {},
                    "prompts": {},
                    "resources": {},
                    "logging": {}
                },
                "serverInfo": {
                    "name": "harness-mcp-server",
                    "version": self.config.version
                }
            }
        });
        
        let message = format!("{}\n", server_info);
        stdout.write_all(message.as_bytes()).await?;
        stdout.flush().await?;
        
        Ok(())
    }
    
    /// Handle incoming MCP message
    async fn handle_message(&self, message: &str, stdout: &mut io::Stdout) -> Result<()> {
        let message = message.trim();
        if message.is_empty() {
            return Ok(());
        }
        
        debug!("Received message: {}", message);
        
        // Parse JSON-RPC message
        let request: serde_json::Value = serde_json::from_str(message)?;
        
        // Extract method and params
        let method = request["method"].as_str()
            .ok_or_else(|| Error::invalid_request("Missing method field"))?;
        
        let params = &request["params"];
        let id = request["id"].clone();
        
        // Route to appropriate handler
        let response = match method {
            "initialize" => self.handle_initialize(params).await?,
            "tools/list" => self.handle_tools_list(params).await?,
            "tools/call" => self.handle_tools_call(params).await?,
            "prompts/list" => self.handle_prompts_list(params).await?,
            "prompts/get" => self.handle_prompts_get(params).await?,
            "resources/list" => self.handle_resources_list(params).await?,
            "resources/read" => self.handle_resources_read(params).await?,
            _ => {
                return Err(Error::invalid_request(format!("Unknown method: {}", method)));
            }
        };
        
        // Send response
        let response_message = serde_json::json!({
            "jsonrpc": "2.0",
            "id": id,
            "result": response
        });
        
        let message = format!("{}\n", response_message);
        stdout.write_all(message.as_bytes()).await?;
        stdout.flush().await?;
        
        Ok(())
    }
    
    /// Handle initialize request
    async fn handle_initialize(&self, _params: &serde_json::Value) -> Result<serde_json::Value> {
        Ok(serde_json::json!({
            "protocolVersion": "2024-11-05",
            "capabilities": {
                "tools": {},
                "prompts": {},
                "resources": {},
                "logging": {}
            },
            "serverInfo": {
                "name": "harness-mcp-server",
                "version": self.config.version
            }
        }))
    }
    
    /// Handle tools/list request
    async fn handle_tools_list(&self, _params: &serde_json::Value) -> Result<serde_json::Value> {
        let tools = self.toolset_manager.list_tools().await?;
        Ok(serde_json::json!({ "tools": tools }))
    }
    
    /// Handle tools/call request
    async fn handle_tools_call(&self, params: &serde_json::Value) -> Result<serde_json::Value> {
        let tool_name = params["name"].as_str()
            .ok_or_else(|| Error::invalid_request("Missing tool name"))?;
        
        let arguments = params["arguments"].as_object()
            .ok_or_else(|| Error::invalid_request("Missing or invalid arguments"))?;
        
        let result = self.toolset_manager.call_tool(tool_name, &serde_json::Value::Object(arguments.clone())).await
            .map_err(|e| Error::toolset(e.to_string()))?;
        
        Ok(serde_json::json!({
            "content": [
                {
                    "type": "text",
                    "text": serde_json::to_string_pretty(&result).unwrap_or_else(|_| "Error serializing result".to_string())
                }
            ]
        }))
    }
    
    /// Handle prompts/list request
    async fn handle_prompts_list(&self, _params: &serde_json::Value) -> Result<serde_json::Value> {
        // TODO: Implement prompts listing
        Ok(serde_json::json!({ "prompts": [] }))
    }
    
    /// Handle prompts/get request
    async fn handle_prompts_get(&self, _params: &serde_json::Value) -> Result<serde_json::Value> {
        // TODO: Implement prompt retrieval
        Ok(serde_json::json!({}))
    }
    
    /// Handle resources/list request
    async fn handle_resources_list(&self, _params: &serde_json::Value) -> Result<serde_json::Value> {
        // TODO: Implement resources listing
        Ok(serde_json::json!({ "resources": [] }))
    }
    
    /// Handle resources/read request
    async fn handle_resources_read(&self, _params: &serde_json::Value) -> Result<serde_json::Value> {
        // TODO: Implement resource reading
        Ok(serde_json::json!({}))
    }
    
    /// Send error response
    async fn send_error_response(&self, stdout: &mut io::Stdout, error: &Error) -> Result<()> {
        let error_response = serde_json::json!({
            "jsonrpc": "2.0",
            "error": {
                "code": -32603,
                "message": error.to_string()
            }
        });
        
        let message = format!("{}\n", error_response);
        stdout.write_all(message.as_bytes()).await?;
        stdout.flush().await?;
        
        Ok(())
    }
}