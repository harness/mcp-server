use crate::config::Config;
use crate::error::Result;
use tracing::{info, error};
use tokio::io::{self, AsyncBufReadExt, AsyncWriteExt, BufReader};

pub async fn run_stdio_server(config: Config) -> Result<()> {
    info!("Starting Harness MCP Server on stdio");
    info!("Configuration: read_only={}, toolsets={:?}", config.read_only, config.toolsets);

    // Create stdin reader and stdout writer
    let stdin = io::stdin();
    let mut stdout = io::stdout();
    let mut reader = BufReader::new(stdin);
    let mut line = String::new();

    // Send initial server info
    let server_info = serde_json::json!({
        "jsonrpc": "2.0",
        "method": "server/info",
        "params": {
            "name": "harness-mcp-server",
            "version": config.version,
            "capabilities": {
                "tools": true,
                "resources": true,
                "prompts": true,
                "logging": true
            }
        }
    });

    let response = format!("{}\n", server_info);
    stdout.write_all(response.as_bytes()).await?;
    stdout.flush().await?;

    info!("Server initialized, waiting for requests...");

    // Main message loop
    loop {
        line.clear();
        match reader.read_line(&mut line).await {
            Ok(0) => {
                info!("Client disconnected");
                break;
            }
            Ok(_) => {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }

                match handle_message(trimmed, &config).await {
                    Ok(response) => {
                        if let Some(resp) = response {
                            let response_line = format!("{}\n", resp);
                            if let Err(e) = stdout.write_all(response_line.as_bytes()).await {
                                error!("Failed to write response: {}", e);
                                break;
                            }
                            if let Err(e) = stdout.flush().await {
                                error!("Failed to flush stdout: {}", e);
                                break;
                            }
                        }
                    }
                    Err(e) => {
                        error!("Error handling message: {}", e);
                        let error_response = serde_json::json!({
                            "jsonrpc": "2.0",
                            "error": {
                                "code": -32603,
                                "message": format!("Internal error: {}", e)
                            }
                        });
                        let response_line = format!("{}\n", error_response);
                        let _ = stdout.write_all(response_line.as_bytes()).await;
                        let _ = stdout.flush().await;
                    }
                }
            }
            Err(e) => {
                error!("Error reading from stdin: {}", e);
                break;
            }
        }
    }

    info!("Server shutting down");
    Ok(())
}

async fn handle_message(message: &str, config: &Config) -> Result<Option<serde_json::Value>> {
    // Parse the JSON-RPC message
    let request: serde_json::Value = serde_json::from_str(message)?;
    
    // Extract method and params
    let method = request.get("method")
        .and_then(|m| m.as_str())
        .unwrap_or("");
    
    let id = request.get("id").cloned();

    match method {
        "initialize" => {
            let response = serde_json::json!({
                "jsonrpc": "2.0",
                "id": id,
                "result": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {
                        "tools": {
                            "listChanged": true
                        },
                        "resources": {
                            "subscribe": true,
                            "listChanged": true
                        },
                        "prompts": {
                            "listChanged": true
                        },
                        "logging": {}
                    },
                    "serverInfo": {
                        "name": "harness-mcp-server",
                        "version": config.version
                    }
                }
            });
            Ok(Some(response))
        }
        "tools/list" => {
            // Return available tools based on configuration
            let tools = get_available_tools(config);
            let response = serde_json::json!({
                "jsonrpc": "2.0",
                "id": id,
                "result": {
                    "tools": tools
                }
            });
            Ok(Some(response))
        }
        "tools/call" => {
            // Handle tool execution
            let params = request.get("params").unwrap_or(&serde_json::Value::Null);
            let result = execute_tool(params, config).await?;
            let response = serde_json::json!({
                "jsonrpc": "2.0",
                "id": id,
                "result": result
            });
            Ok(Some(response))
        }
        "ping" => {
            let response = serde_json::json!({
                "jsonrpc": "2.0",
                "id": id,
                "result": {}
            });
            Ok(Some(response))
        }
        _ => {
            // Unknown method
            let response = serde_json::json!({
                "jsonrpc": "2.0",
                "id": id,
                "error": {
                    "code": -32601,
                    "message": format!("Method not found: {}", method)
                }
            });
            Ok(Some(response))
        }
    }
}

fn get_available_tools(config: &Config) -> Vec<serde_json::Value> {
    // Return a basic set of tools for now
    vec![
        serde_json::json!({
            "name": "list_connectors",
            "description": "List connectors in Harness",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "orgIdentifier": {
                        "type": "string",
                        "description": "Organization identifier"
                    },
                    "projectIdentifier": {
                        "type": "string", 
                        "description": "Project identifier"
                    }
                }
            }
        }),
        serde_json::json!({
            "name": "list_pipelines",
            "description": "List pipelines in Harness",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "orgIdentifier": {
                        "type": "string",
                        "description": "Organization identifier"
                    },
                    "projectIdentifier": {
                        "type": "string",
                        "description": "Project identifier"
                    }
                }
            }
        })
    ]
}

async fn execute_tool(params: &serde_json::Value, config: &Config) -> Result<serde_json::Value> {
    let tool_name = params.get("name")
        .and_then(|n| n.as_str())
        .unwrap_or("");

    match tool_name {
        "list_connectors" => {
            // Placeholder implementation
            Ok(serde_json::json!({
                "content": [
                    {
                        "type": "text",
                        "text": "Connector listing functionality will be implemented here"
                    }
                ]
            }))
        }
        "list_pipelines" => {
            // Placeholder implementation
            Ok(serde_json::json!({
                "content": [
                    {
                        "type": "text", 
                        "text": "Pipeline listing functionality will be implemented here"
                    }
                ]
            }))
        }
        _ => {
            Ok(serde_json::json!({
                "content": [
                    {
                        "type": "text",
                        "text": format!("Unknown tool: {}", tool_name)
                    }
                ]
            }))
        }
    }
}