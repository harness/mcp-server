use anyhow::Result;
use serde_json::Value;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tracing::{info, instrument, error};

use crate::config::Config;

#[instrument(skip(config))]
pub async fn run(config: Config) -> Result<()> {
    let stdio_config = config.stdio_config.as_ref()
        .ok_or_else(|| anyhow::anyhow!("Stdio config not found"))?;
    
    info!(
        base_url = stdio_config.base_url,
        account_id = stdio_config.account_id,
        "Starting stdio server"
    );
    
    let stdin = tokio::io::stdin();
    let mut stdout = tokio::io::stdout();
    let mut reader = BufReader::new(stdin);
    let mut line = String::new();
    
    loop {
        line.clear();
        
        match reader.read_line(&mut line).await {
            Ok(0) => {
                // EOF reached
                info!("EOF reached, shutting down");
                break;
            }
            Ok(_) => {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }
                
                match handle_mcp_message(trimmed, &config).await {
                    Ok(response) => {
                        if let Err(e) = stdout.write_all(response.as_bytes()).await {
                            error!("Failed to write response: {}", e);
                            break;
                        }
                        if let Err(e) = stdout.write_all(b"\n").await {
                            error!("Failed to write newline: {}", e);
                            break;
                        }
                        if let Err(e) = stdout.flush().await {
                            error!("Failed to flush stdout: {}", e);
                            break;
                        }
                    }
                    Err(e) => {
                        error!("Failed to handle MCP message: {}", e);
                        let error_response = serde_json::json!({
                            "jsonrpc": "2.0",
                            "error": {
                                "code": -32603,
                                "message": format!("Internal error: {}", e)
                            },
                            "id": null
                        });
                        
                        let response = serde_json::to_string(&error_response)?;
                        if let Err(e) = stdout.write_all(response.as_bytes()).await {
                            error!("Failed to write error response: {}", e);
                            break;
                        }
                        if let Err(e) = stdout.write_all(b"\n").await {
                            error!("Failed to write newline: {}", e);
                            break;
                        }
                        if let Err(e) = stdout.flush().await {
                            error!("Failed to flush stdout: {}", e);
                            break;
                        }
                    }
                }
            }
            Err(e) => {
                error!("Failed to read from stdin: {}", e);
                break;
            }
        }
    }
    
    Ok(())
}

async fn handle_mcp_message(message: &str, _config: &Config) -> Result<String> {
    // Parse the JSON-RPC message
    let request: Value = serde_json::from_str(message)?;
    
    // TODO: Implement proper MCP protocol handling
    // This is a placeholder that echoes the request
    info!("Received MCP message: {:?}", request);
    
    let response = serde_json::json!({
        "jsonrpc": "2.0",
        "id": request.get("id"),
        "result": {
            "message": "MCP handler not yet implemented"
        }
    });
    
    Ok(serde_json::to_string(&response)?)
}