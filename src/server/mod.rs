use crate::auth::{create_configured_auth_provider, AuthState};
use crate::client::HarnessClient;
use crate::config::{Config, TransportConfig};
use crate::error::Result;
use crate::mcp::McpServer;
use crate::transport::{HttpTransport, StdioTransport};
use std::sync::Arc;
use tracing::info;

pub struct HarnessServer {
    config: Config,
    mcp_server: McpServer,
    auth_state: AuthState,
    client: Arc<HarnessClient>,
}

impl HarnessServer {
    pub async fn new(config: Config) -> Result<Self> {
        info!("Initializing Harness MCP Server");
        
        // Create authentication provider
        let auth_provider = create_configured_auth_provider(&config)?;
        let auth_state = AuthState::new(auth_provider.clone());
        
        // Create HTTP client
        let client = Arc::new(HarnessClient::new(
            config.harness.base_url.clone(),
            auth_provider,
            None,
        )?);
        
        // Create MCP server
        let mcp_server = McpServer::new();
        
        info!("Harness MCP Server initialized successfully");
        
        Ok(Self {
            config,
            mcp_server,
            auth_state,
            client,
        })
    }
    
    pub async fn run_stdio(&self) -> Result<()> {
        let transport = StdioTransport::new(self.mcp_server.clone());
        transport.run().await
    }
    
    pub async fn run_http(&self) -> Result<()> {
        match &self.config.transport {
            TransportConfig::Http { port, path } => {
                let transport = HttpTransport::new(
                    self.mcp_server.clone(),
                    *port,
                    path.clone(),
                    self.auth_state.clone(),
                );
                transport.run().await
            }
            TransportConfig::Stdio => {
                Err(crate::error::HarnessError::Configuration(
                    "HTTP transport requested but stdio configured".to_string(),
                ))
            }
        }
    }
}