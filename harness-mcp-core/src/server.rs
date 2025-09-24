use crate::config::Config;
use crate::error::{McpError, Result};
use crate::protocol::McpProtocolHandler;
use crate::tools::ToolRegistry;
use crate::transport::{HttpTransport, StdioTransport, Transport};
use std::io::{Read, Write};
use tracing::{info, warn};

pub struct McpServer {
    config: Config,
    protocol_handler: McpProtocolHandler,
}

impl McpServer {
    pub async fn new(mut config: Config) -> Result<Self> {
        // Extract account ID from API key
        config.extract_account_id()?;

        // Initialize tool registry
        let tool_registry = ToolRegistry::new(&config).await?;

        // Create protocol handler
        let protocol_handler = McpProtocolHandler::new(config.clone(), tool_registry);

        Ok(Self {
            config,
            protocol_handler,
        })
    }

    pub async fn run_stdio<R: Read, W: Write>(&mut self, reader: R, writer: W) -> Result<()> {
        info!("Starting MCP server in stdio mode");
        
        let transport = StdioTransport::new(reader, writer);
        self.run_with_transport(transport).await
    }

    pub async fn run_http(&mut self, port: u16, path: &str) -> Result<()> {
        info!("Starting MCP server in HTTP mode on port {} with path {}", port, path);
        
        let transport = HttpTransport::new(port, path.to_string());
        self.run_with_transport(transport).await
    }

    async fn run_with_transport<T: Transport>(&mut self, mut transport: T) -> Result<()> {
        // Set up graceful shutdown
        let shutdown = async {
            tokio::signal::ctrl_c()
                .await
                .expect("Failed to install CTRL+C signal handler");
            warn!("Received shutdown signal");
        };

        tokio::select! {
            result = transport.run(&mut self.protocol_handler) => {
                match result {
                    Ok(_) => info!("Server stopped normally"),
                    Err(e) => return Err(e),
                }
            }
            _ = shutdown => {
                info!("Shutting down server...");
            }
        }

        Ok(())
    }
}