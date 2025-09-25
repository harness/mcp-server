//! STDIO transport server implementation

use anyhow::Result;
use harness_mcp_config::Config;
use harness_mcp_core::{
    transport::{StdioTransport, Transport},
    types::{JsonRpcRequest, JsonRpcResponse, JsonRpcError},
};
use crate::{cli::StdioArgs, server::{create_mcp_server, create_protocol}};
use tracing::{info, error};

/// Run the STDIO server
pub async fn run(config: Config, args: StdioArgs) -> Result<()> {
    info!("Starting STDIO server");
    info!("Base URL: {}", args.base_url);
    info!("Read-only mode: {}", config.server.read_only);
    
    // Create MCP server
    let mcp_server = create_mcp_server(&config, Some(args.api_key), None).await?;
    
    // Create protocol handler
    let protocol = create_protocol(mcp_server, "harness-mcp-server");
    
    // Create transport
    let mut transport = StdioTransport::new();
    
    info!("STDIO server started, waiting for requests");
    
    // Main event loop
    loop {
        match transport.receive().await {
            Ok(request) => {
                let response = protocol.handle_request(request).await
                    .unwrap_or_else(|e| {
                        error!("Error handling request: {}", e);
                        JsonRpcResponse {
                            jsonrpc: "2.0".to_string(),
                            id: None,
                            result: None,
                            error: Some(JsonRpcError {
                                code: -32603,
                                message: e.to_string(),
                                data: None,
                            }),
                        }
                    });
                
                if let Err(e) = transport.send(response).await {
                    error!("Error sending response: {}", e);
                    break;
                }
            }
            Err(e) => {
                error!("Error receiving request: {}", e);
                break;
            }
        }
    }
    
    Ok(())
}