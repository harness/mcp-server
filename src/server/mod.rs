pub mod stdio;
pub mod http;
pub mod internal;
pub mod middleware;

use crate::config::Config;
use crate::error::Result;
use crate::mcp::McpServer;
use crate::tools::ToolsetRegistry;
use tracing::info;

/// Create a new MCP server with the given configuration
pub fn create_mcp_server(config: &Config) -> Result<McpServer> {
    info!("Creating MCP server with config: read_only={}, toolsets={:?}", 
          config.read_only, config.toolsets);
    
    let mut server = McpServer::new(&config.version);
    
    // Register toolsets
    let registry = ToolsetRegistry::new(config.clone());
    registry.register_tools(&mut server)?;
    
    Ok(server)
}