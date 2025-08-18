//! Unlicensed module implementation

use crate::{
    config::Config,
    modules::Module,
    tools::ToolRegistry,
    Result,
};

/// Unlicensed module for features available without license
pub struct UnlicensedModule {
    config: Config,
}

impl UnlicensedModule {
    /// Create a new instance of UnlicensedModule
    pub fn new(config: Config) -> Self {
        Self { config }
    }
}

impl Module for UnlicensedModule {
    fn id(&self) -> &str {
        "UNLICENSED"
    }

    fn name(&self) -> &str {
        "Unlicensed Features"
    }

    fn is_default(&self) -> bool {
        false
    }

    async fn register_tools(&self, _registry: &mut ToolRegistry) -> Result<()> {
        // TODO: Implement unlicensed module toolset registration
        Ok(())
    }
}