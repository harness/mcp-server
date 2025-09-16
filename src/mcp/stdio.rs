use crate::config::StdioConfig;
use crate::error::Result;
use crate::mcp::{McpServer, JsonRpcRequest, JsonRpcResponse};
use crate::client::HttpClient;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tracing::{info, error, debug};
use serde_json;

pub async fn run_stdio_server(config: StdioConfig) -> Result<()> {
    info!("Starting stdio server with base URL: {}", config.base_url);
    
    // Create HTTP client with API key
    let http_client = HttpClient::new(config.base_url.clone())
        .with_api_key(config.api_key.clone());
    
    // Create MCP server instance
    let mcp_server = McpServer::new();
    
    // Register tools with the server
    register_default_tools(&mcp_server, http_client).await;
    
    // Create stdio transport
    let transport = StdioTransport::new(mcp_server);
    
    // Start the server
    transport.run().await?;
    
    Ok(())
}

pub struct StdioTransport {
    server: McpServer,
}

impl StdioTransport {
    pub fn new(server: McpServer) -> Self {
        Self { server }
    }

    pub async fn run(&self) -> Result<()> {
        let stdin = tokio::io::stdin();
        let mut stdout = tokio::io::stdout();
        let mut reader = BufReader::new(stdin);
        let mut line = String::new();

        info!("MCP stdio server ready for requests");

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

                    match serde_json::from_str::<JsonRpcRequest>(trimmed) {
                        Ok(request) => {
                            match self.server.handle_request(request).await {
                                Ok(response) => {
                                    let response_json = serde_json::to_string(&response)?;
                                    stdout.write_all(response_json.as_bytes()).await?;
                                    stdout.write_all(b"\n").await?;
                                    stdout.flush().await?;
                                }
                                Err(e) => {
                                    error!("Error handling request: {}", e);
                                }
                            }
                        }
                        Err(e) => {
                            error!("Failed to parse JSON-RPC request: {}", e);
                            let error_response = JsonRpcResponse::error(
                                None,
                                crate::mcp::JsonRpcError::custom(-32700, "Parse error".to_string()),
                            );
                            let response_json = serde_json::to_string(&error_response)?;
                            stdout.write_all(response_json.as_bytes()).await?;
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
}

async fn register_default_tools(server: &McpServer, client: HttpClient) {
    use crate::tools::pipelines::{GetPipelineTool, ListPipelinesTool};
    use crate::tools::connectors::{GetConnectorDetailsTool, ListConnectorCatalogueTool, ListConnectorsTool};
    
    // Register pipeline tools
    server.register_tool("get_pipeline".to_string(), Box::new(GetPipelineTool::new(client.clone()))).await;
    server.register_tool("list_pipelines".to_string(), Box::new(ListPipelinesTool::new(client.clone()))).await;
    
    // Register connector tools
    server.register_tool("get_connector_details".to_string(), Box::new(GetConnectorDetailsTool::new(client.clone()))).await;
    server.register_tool("list_connector_catalogue".to_string(), Box::new(ListConnectorCatalogueTool::new(client.clone()))).await;
    server.register_tool("list_connectors".to_string(), Box::new(ListConnectorsTool::new(client))).await;
    
    info!("Registered {} tools with MCP server", 5);
}