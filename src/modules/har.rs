//! Harness Application Registry (HAR) module implementation

use crate::{
    config::Config,
    modules::Module,
    tools::ToolRegistry,
    Result,
};

/// HAR (Harness Application Registry) module
pub struct HARModule {
    config: Config,
}

impl HARModule {
    /// Create a new instance of HARModule
    pub fn new(config: Config) -> Self {
        Self { config }
    }
}

impl Module for HARModule {
    fn id(&self) -> &str {
        "HAR"
    }

    fn name(&self) -> &str {
        "Harness Application Registry"
    }

    fn is_default(&self) -> bool {
        false
    }

    async fn register_tools(&self, _registry: &mut ToolRegistry) -> Result<()> {
        // TODO: Implement HAR module toolset registration
        Ok(())
    }
}