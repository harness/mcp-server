pub mod auth;
pub mod client;
pub mod common;
pub mod middleware;
pub mod server;
pub mod tools;

pub use server::HarnessServer;

/// Default tools to enable when no specific toolsets are requested
pub const DEFAULT_TOOLS: &[&str] = &[];

use crate::config::Config;
use crate::toolsets::ToolsetGroup;
use crate::types::HarnessError;
use anyhow::Result;

/// Initialize toolsets based on configuration
pub async fn init_toolsets(config: &Config) -> Result<ToolsetGroup, HarnessError> {
    let mut toolset_group = ToolsetGroup::new(config.read_only);
    
    // TODO: Register all available toolsets
    // This would include pipelines, pull requests, repositories, etc.
    
    // Enable requested toolsets
    if config.toolsets.is_empty() {
        // Enable default toolsets
        toolset_group.enable_toolsets(&["default".to_string()])?;
    } else {
        toolset_group.enable_toolsets(&config.toolsets)?;
    }
    
    Ok(toolset_group)
}