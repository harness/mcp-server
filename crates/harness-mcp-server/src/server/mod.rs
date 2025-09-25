//! Server implementations for different transport modes

pub mod stdio;
pub mod http;
pub mod internal;

use anyhow::Result;
use harness_mcp_config::Config;
use harness_mcp_core::{
    mcp::McpProtocol,
    server::{DefaultMcpServer, McpServer},
    types::ServerInfo,
};
use harness_mcp_auth::providers::{ApiKeyProvider, BearerTokenProvider};
use harness_mcp_client::Client;
use harness_mcp_tools::{toolsets::ToolsetRegistry, ServiceFactory, ToolHandlerFactory};
use std::sync::Arc;
use tracing::{info, warn};
use url::Url;

/// Create and configure an MCP server with tools and authentication
pub async fn create_mcp_server(
    config: &Config,
    api_key: Option<String>,
    bearer_token: Option<String>,
) -> Result<Arc<dyn McpServer>> {
    info!("Creating MCP server");
    
    // Create the MCP server
    let server = Arc::new(DefaultMcpServer::new());
    
    // Determine authentication method
    let auth_provider: Arc<dyn harness_mcp_auth::AuthProvider> = if let Some(api_key) = api_key {
        Arc::new(ApiKeyProvider::new(api_key)?)
    } else if let Some(token) = bearer_token {
        Arc::new(BearerTokenProvider::new(token, None))
    } else if let Some(api_key) = &config.auth.api_key {
        Arc::new(ApiKeyProvider::new(api_key.clone())?)
    } else {
        return Err(anyhow::anyhow!("No authentication method provided"));
    };
    
    // Create HTTP client and service factory
    let base_url = Url::parse(&config.harness.base_url)?;
    let service_factory = Arc::new(ServiceFactory::new(base_url, auth_provider, None)?);
    
    // Create tool handler factory
    let handler_factory = ToolHandlerFactory::new(service_factory);
    
    // Create all tools with actual handlers
    let tools_with_handlers = handler_factory.create_all_tools();
    
    // Register tools with their handlers
    for (tool, handler) in tools_with_handlers {
        server.add_tool(tool, handler).await;
    }
    
    info!("MCP server created with {} enabled toolsets", registry.get_enabled_toolsets().len());
    Ok(server)
}

/// Create MCP protocol handler
pub fn create_protocol(server: Arc<dyn McpServer>, server_name: &str) -> Arc<McpProtocol> {
    let server_info = ServerInfo {
        name: server_name.to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    };
    
    Arc::new(McpProtocol::new(server, server_info))
}