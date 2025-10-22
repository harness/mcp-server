//! STDIO server implementation

use crate::{config::Config, error::Result};
use harness_mcp_proto::{McpServer, StdioTransport};
use std::sync::Arc;
use tracing::info;

/// STDIO server for MCP protocol
pub struct StdioServer {
    config: Config,
    mcp_server: Arc<McpServer>,
}

impl StdioServer {
    /// Create a new STDIO server
    pub async fn new(mut config: Config) -> Result<Self> {
        // Extract account ID from API key if needed
        if config.api_key.is_some() {
            config.extract_account_id()?;
        }

        let mcp_server = Arc::new(McpServer::new(
            crate::SERVER_NAME.to_string(),
            config.version.clone(),
        ));

        // TODO: Initialize tools, prompts, and resources based on config
        
        Ok(Self {
            config,
            mcp_server,
        })
    }

    /// Start serving STDIO requests
    pub async fn serve(self) -> Result<()> {
        info!("Starting STDIO server");

        let transport = StdioTransport::new(self.mcp_server);
        transport.serve().await?;
        Ok(())
    }
}