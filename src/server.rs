use anyhow::Result;
use crate::harness::errors::HarnessResult;
use jsonrpc_core::{IoHandler, Params, Value};
use jsonrpc_stdio_server::ServerBuilder;
use std::io;
use tokio::io::{AsyncRead, AsyncWrite};
use tracing::{info, debug};

use crate::config::Config;
use crate::harness::HarnessServer;

pub struct StdioServer {
    config: Config,
    harness_server: HarnessServer,
}

impl StdioServer {
    pub async fn new(config: Config) -> HarnessResult<Self> {
        debug!("Creating new StdioServer with config: {:?}", config);
        
        let harness_server = HarnessServer::new(&config).await?;
        
        Ok(Self {
            config,
            harness_server,
        })
    }
    
    pub async fn run(self) -> HarnessResult<()> {
        info!("Starting Harness MCP Server on stdio");
        
        // Create JSON-RPC handler
        let mut io = IoHandler::new();
        
        // Register MCP protocol methods
        self.register_mcp_methods(&mut io).await?;
        
        // Create stdio server
        let server = ServerBuilder::new(io)
            .build();
        
        // Run the server on stdin/stdout
        let stdin = tokio::io::stdin();
        let stdout = tokio::io::stdout();
        
        server.serve(stdin, stdout).await?;
        
        Ok(())
    }
    
    async fn register_mcp_methods(&self, io: &mut IoHandler) -> HarnessResult<()> {
        // Initialize method - required by MCP protocol
        let harness_server = self.harness_server.clone();
        io.add_method("initialize", move |params: Params| {
            let harness_server = harness_server.clone();
            async move {
                debug!("Received initialize request: {:?}", params);
                
                // Parse initialization parameters
                let _init_params: serde_json::Value = params.parse()?;
                
                // Return server capabilities
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
                        "version": env!("CARGO_PKG_VERSION")
                    }
                }))
            }
        });
        
        // Initialized notification - required by MCP protocol
        io.add_notification("initialized", |params: Params| {
            debug!("Received initialized notification: {:?}", params);
        });
        
        // Tools list method
        io.add_method("tools/list", move |_params: Params| async move {
            debug!("Received tools/list request");
            
            // Return available tools based on configuration
            Ok(serde_json::json!({
                "tools": []
            }))
        });
        
        // Tools call method
        let harness_server_call = self.harness_server.clone();
        io.add_method("tools/call", move |params: Params| {
            let harness_server = harness_server_call.clone();
            async move {
                debug!("Received tools/call request: {:?}", params);
                
                // Parse tool call parameters
                let call_params: serde_json::Value = params.parse()?;
                
                // TODO: Route to appropriate tool handler
                // let tool_call = ToolCall::from_json(call_params)?;
                // let result = harness_server.execute_tool(tool_call).await?;
                
                // Execute tool and return result
                Ok(serde_json::json!({
                    "content": [
                        {
                            "type": "text",
                            "text": "Tool execution not yet implemented"
                        }
                    ]
                }))
            }
        });
        
        // Prompts list method
        io.add_method("prompts/list", |_params: Params| async move {
            debug!("Received prompts/list request");
            
            Ok(serde_json::json!({
                "prompts": []
            }))
        });
        
        // Prompts get method
        io.add_method("prompts/get", |params: Params| async move {
            debug!("Received prompts/get request: {:?}", params);
            
            Ok(serde_json::json!({
                "messages": []
            }))
        });
        
        // Resources list method
        io.add_method("resources/list", |_params: Params| async move {
            debug!("Received resources/list request");
            
            Ok(serde_json::json!({
                "resources": []
            }))
        });
        
        // Resources read method
        io.add_method("resources/read", |params: Params| async move {
            debug!("Received resources/read request: {:?}", params);
            
            Ok(serde_json::json!({
                "contents": []
            }))
        });
        
        info!("Registered all MCP protocol methods");
        Ok(())
    }
}