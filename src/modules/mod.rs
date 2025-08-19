// Modules system for organizing toolsets
// This will be populated during the conversion process

use anyhow::Result;
use crate::config::Config;
use crate::toolsets::ToolsetGroup;

pub trait Module {
    fn id(&self) -> &str;
    fn is_default(&self) -> bool;
    async fn register_toolsets(&self) -> Result<()>;
    async fn enable_toolsets(&self, group: &mut ToolsetGroup) -> Result<()>;
}

pub struct ModuleRegistry {
    config: Config,
    modules: Vec<Box<dyn Module + Send + Sync>>,
}

impl ModuleRegistry {
    pub fn new(config: Config) -> Self {
        Self {
            config,
            modules: Vec::new(),
        }
    }

    pub fn get_enabled_modules(&self) -> Vec<&dyn Module> {
        // TODO: Implement module filtering based on configuration
        self.modules.iter().map(|m| m.as_ref()).collect()
    }
}