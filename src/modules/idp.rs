//! Internal Developer Portal (IDP) module implementation

use crate::{
    config::Config,
    modules::Module,
    tools::ToolRegistry,
    Result,
};

/// IDP (Internal Developer Portal) module
pub struct IDPModule {
    config: Config,
}

impl IDPModule {
    /// Create a new instance of IDPModule
    pub fn new(config: Config) -> Self {
        Self { config }
    }
}

impl Module for IDPModule {
    fn id(&self) -> &str {
        "IDP"
    }

    fn name(&self) -> &str {
        "Internal Developer Portal"
    }

    fn is_default(&self) -> bool {
        false
    }

    async fn register_tools(&self, _registry: &mut ToolRegistry) -> Result<()> {
        // TODO: Implement IDP module toolset registration
        Ok(())
    }
}