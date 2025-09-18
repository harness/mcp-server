use crate::config::Config;
use crate::error::Result;
use tokio::io::{self, AsyncBufReadExt, AsyncWriteExt, BufReader};
use tracing::{debug, error, info};
use serde_json::{json, Value};

/// Run the stdio server
pub async fn run_server(config: Config) -> Result<()> {
    info!("Starting stdio server");
    info!("Configuration: internal={}, read_only={}", config.internal, config.read_only);

    let stdin = io::stdin();
    let mut stdout = io::stdout();
    let mut reader = BufReader::new(stdin);
    let mut line = String::new();

    // Send initial capabilities response
    let capabilities = json!({
        "jsonrpc": "2.0",
        "id": null,
        "result": {
            "protocolVersion": "2025-03-26",
            "capabilities": {
                "tools": {},
                "resources": {},
                "prompts": {}
            },
            "serverInfo": {
                "name": "harness-mcp-server",
                "version": config.version
            }
        }
    });

    debug!("Server capabilities: {}", capabilities);

    loop {
        line.clear();
        match reader.read_line(&mut line).await {
            Ok(0) => {
                // EOF reached
                info!("EOF reached, shutting down stdio server");
                break;
            }
            Ok(_) => {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }

                debug!("Received: {}", trimmed);

                // Parse JSON-RPC request
                match serde_json::from_str::<Value>(trimmed) {
                    Ok(request) => {
                        let response = handle_request(request, &config).await;
                        let response_str = serde_json::to_string(&response).unwrap();
                        
                        debug!("Sending: {}", response_str);
                        
                        if let Err(e) = stdout.write_all(response_str.as_bytes()).await {
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
                        error!("Failed to parse JSON: {}", e);
                        let error_response = json!({
                            "jsonrpc": "2.0",
                            "id": null,
                            "error": {
                                "code": -32700,
                                "message": "Parse error"
                            }
                        });
                        let response_str = serde_json::to_string(&error_response).unwrap();
                        let _ = stdout.write_all(response_str.as_bytes()).await;
                        let _ = stdout.write_all(b"\n").await;
                        let _ = stdout.flush().await;
                    }
                }
            }
            Err(e) => {
                error!("Failed to read from stdin: {}", e);
                break;
            }
        }
    }

    info!("Stdio server shut down");
    Ok(())
}

/// Handle a JSON-RPC request
async fn handle_request(request: Value, config: &Config) -> Value {
    let method = request.get("method").and_then(|m| m.as_str());
    let id = request.get("id");

    match method {
        Some("initialize") => {
            json!({
                "jsonrpc": "2.0",
                "id": id,
                "result": {
                    "protocolVersion": "2025-03-26",
                    "capabilities": {
                        "tools": {},
                        "resources": {},
                        "prompts": {}
                    },
                    "serverInfo": {
                        "name": "harness-mcp-server",
                        "version": config.version
                    }
                }
            })
        }
        Some("tools/list") => {
            json!({
                "jsonrpc": "2.0",
                "id": id,
                "result": {
                    "tools": []
                }
            })
        }
        Some("tools/call") => {
            json!({
                "jsonrpc": "2.0",
                "id": id,
                "error": {
                    "code": -32601,
                    "message": "Tool not implemented"
                }
            })
        }
        Some("resources/list") => {
            json!({
                "jsonrpc": "2.0",
                "id": id,
                "result": {
                    "resources": []
                }
            })
        }
        Some("prompts/list") => {
            json!({
                "jsonrpc": "2.0",
                "id": id,
                "result": {
                    "prompts": []
                }
            })
        }
        _ => {
            json!({
                "jsonrpc": "2.0",
                "id": id,
                "error": {
                    "code": -32601,
                    "message": "Method not found"
                }
            })
        }
    }
}