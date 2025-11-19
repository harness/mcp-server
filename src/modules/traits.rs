use anyhow::Result;
use async_trait::async_trait;
use crate::toolsets::ToolsetGroup;

/// Module trait defines the contract that all modules must implement
#[async_trait]
pub trait Module: Send + Sync {
    /// Returns the identifier for this module
    fn id(&self) -> &str;
    
    /// Returns the name of module
    fn name(&self) -> &str;
    
    /// Returns the names of toolsets provided by this module
    fn toolsets(&self) -> Vec<String>;
    
    /// Registers all toolsets in this module with the toolset group
    /// It creates necessary clients and adds tools to the toolset group
    async fn register_toolsets(&self) -> Result<()>;
    
    /// Enables all toolsets in this module in the toolset group
    /// This is called after register_toolsets to activate the toolsets
    async fn enable_toolsets(&self, tsg: &mut ToolsetGroup) -> Result<()>;
    
    /// Indicates if this module should be enabled by default
    /// when no specific modules are requested
    fn is_default(&self) -> bool;
}

/// Helper function that safely enables toolsets
/// by only enabling toolsets that actually exist in the toolset group
pub async fn module_enable_toolsets(
    module: &dyn Module,
    tsg: &mut ToolsetGroup,
) -> Result<()> {
    // Only enable toolsets that exist in the toolset group
    let mut existing_toolsets = Vec::new();
    for toolset_name in module.toolsets() {
        // Check if toolset exists in the group
        if tsg.has_toolset(&toolset_name) {
            existing_toolsets.push(toolset_name);
        }
    }

    // Enable only the existing toolsets
    if existing_toolsets.is_empty() {
        return Ok(());
    }

    // Enable the toolsets
    tsg.enable_toolsets(existing_toolsets).await
}