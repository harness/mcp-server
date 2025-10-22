//! HTTP server implementation

use crate::{config::Config, error::Result};
use harness_mcp_proto::{HttpTransport, McpServer};
use std::sync::Arc;
use tracing::info;

/// HTTP server for MCP protocol
pub struct HttpServer {
    config: Config,
    mcp_server: Arc<McpServer>,
}

impl HttpServer {
    /// Create a new HTTP server
    pub async fn new(config: Config) -> Result<Self> {
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

    /// Start serving HTTP requests
    pub async fn serve(self) -> Result<()> {
        info!(
            "Starting HTTP server on port {} with path {}",
            self.config.http.port, self.config.http.path
        );

        let transport = HttpTransport::new(
            self.mcp_server,
            self.config.http.port,
            self.config.http.path,
        );

        transport.serve().await?;
        Ok(())
    }
}