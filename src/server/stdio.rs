use crate::config::Config;
use crate::error::Result;
use crate::server::create_mcp_server;
use tokio::io::{stdin, stdout, AsyncBufReadExt, AsyncWriteExt, BufReader};
use tracing::{info, error, debug};
use serde_json::Value;

pub async fn run(config: Config) -> Result<()> {
    info!("Starting stdio MCP server");
    
    let server = create_mcp_server(&config)?;
    
    let stdin = stdin();
    let mut stdout = stdout();
    let mut reader = BufReader::new(stdin);
    let mut line = String::new();
    
    info!("Harness MCP Server running on stdio, version: {}", config.version);
    
    loop {
        line.clear();
        
        match reader.read_line(&mut line).await {
            Ok(0) => {
                debug!("EOF reached, shutting down");
                break;
            }
            Ok(_) => {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }
                
                debug!("Received message: {}", trimmed);
                
                // Parse JSON-RPC message
                match serde_json::from_str::<Value>(trimmed) {
                    Ok(request) => {
                        // Process the request
                        match server.handle_request(request).await {
                            Ok(response) => {
                                let response_str = serde_json::to_string(&response)?;
                                debug!("Sending response: {}", response_str);
                                
                                stdout.write_all(response_str.as_bytes()).await?;
                                stdout.write_all(b"\n").await?;
                                stdout.flush().await?;
                            }
                            Err(e) => {
                                error!("Error processing request: {}", e);
                                // Send error response
                                let error_response = serde_json::json!({
                                    "jsonrpc": "2.0",
                                    "id": request.get("id"),
                                    "error": {
                                        "code": -32603,
                                        "message": "Internal error",
                                        "data": e.to_string()
                                    }
                                });
                                let error_str = serde_json::to_string(&error_response)?;
                                stdout.write_all(error_str.as_bytes()).await?;
                                stdout.write_all(b"\n").await?;
                                stdout.flush().await?;
                            }
                        }
                    }
                    Err(e) => {
                        error!("Failed to parse JSON-RPC message: {}", e);
                        // Send parse error response
                        let error_response = serde_json::json!({
                            "jsonrpc": "2.0",
                            "id": null,
                            "error": {
                                "code": -32700,
                                "message": "Parse error"
                            }
                        });
                        let error_str = serde_json::to_string(&error_response)?;
                        stdout.write_all(error_str.as_bytes()).await?;
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
    
    info!("Stdio server shutting down");
    Ok(())
}