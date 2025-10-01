use crate::error::Result;
use crate::mcp::{JsonRpcRequest, JsonRpcResponse, McpServer};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tracing::{debug, error, info};

pub struct StdioTransport {
    server: McpServer,
}

impl StdioTransport {
    pub fn new(server: McpServer) -> Self {
        Self { server }
    }
    
    pub async fn run(&self) -> Result<()> {
        info!("Starting MCP server in stdio mode");
        
        let stdin = tokio::io::stdin();
        let mut stdout = tokio::io::stdout();
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
                    let trimmed = line.trim();
                    if trimmed.is_empty() {
                        continue;
                    }
                    
                    debug!("Received request: {}", trimmed);
                    
                    match self.handle_request(trimmed).await {
                        Ok(response) => {
                            let response_json = serde_json::to_string(&response)?;
                            debug!("Sending response: {}", response_json);
                            
                            stdout.write_all(response_json.as_bytes()).await?;
                            stdout.write_all(b"\\n").await?;
                            stdout.flush().await?;
                        }
                        Err(e) => {
                            error!("Error handling request: {}", e);
                            
                            let error_response = JsonRpcResponse::error(
                                None,
                                crate::mcp::JsonRpcError::new(-32603, e.to_string()),
                            );
                            
                            let response_json = serde_json::to_string(&error_response)?;
                            stdout.write_all(response_json.as_bytes()).await?;
                            stdout.write_all(b"\\n").await?;
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
        
        info!("Stdio transport shutting down");
        Ok(())
    }
    
    async fn handle_request(&self, request_json: &str) -> Result<JsonRpcResponse> {
        let request: JsonRpcRequest = serde_json::from_str(request_json)?;
        self.server.handle_request(request).await
    }
}