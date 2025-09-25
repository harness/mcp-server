use crate::config::Config;
use crate::error::Result;
use crate::mcp::{JsonRpcRequest, server::McpServer};
use crate::tools;
use tracing::{info, debug, error};
use tokio::io::{self, AsyncBufReadExt, AsyncWriteExt, BufReader};

/// Run the MCP server with stdio transport
pub async fn run(config: Config) -> Result<()> {
    info!("Starting stdio server with config: {:?}", config);
    
    // Initialize tools
    let tool_registry = tools::init_tools(&config)?;
    
    // Create MCP server
    let mut mcp_server = McpServer::new(config.clone(), tool_registry);
    
    let stdin = io::stdin();
    let mut stdout = io::stdout();
    let mut reader = BufReader::new(stdin);
    let mut line = String::new();
    
    info!("Harness MCP Server running on stdio, version: {}", config.version);
    
    // JSON-RPC communication loop
    loop {
        line.clear();
        match reader.read_line(&mut line).await {
            Ok(0) => {
                debug!("EOF reached, shutting down");
                break;
            }
            Ok(_) => {
                let trimmed_line = line.trim();
                if trimmed_line.is_empty() {
                    continue;
                }
                
                debug!("Received line: {}", trimmed_line);
                
                // Parse JSON-RPC request
                let request: JsonRpcRequest = match serde_json::from_str(trimmed_line) {
                    Ok(req) => req,
                    Err(e) => {
                        error!("Failed to parse JSON-RPC request: {}", e);
                        continue;
                    }
                };
                
                // Handle request with MCP server
                let response = mcp_server.handle_request(request).await;
                
                // Send response back
                match serde_json::to_string(&response) {
                    Ok(response_json) => {
                        stdout.write_all(response_json.as_bytes()).await?;
                        stdout.write_all(b"\n").await?;
                        stdout.flush().await?;
                    }
                    Err(e) => {
                        error!("Failed to serialize MCP response: {}", e);
                    }
                }
            }
            Err(e) => {
                error!("Error reading from stdin: {}", e);
                break;
            }
        }
    }
    
    info!("Stdio server shutting down");
    Ok(())
}