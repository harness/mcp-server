//! Module system for organizing functionality

use crate::types::{Config, Result};
use async_trait::async_trait;

/// Trait for Harness modules
#[async_trait]
pub trait Module: Send + Sync {
    /// Get the module ID
    fn id(&self) -> &str;
    
    /// Get the module name
    fn name(&self) -> &str;
    
    /// Get the module description
    fn description(&self) -> &str;
    
    /// Check if this is a default module (always enabled)
    fn is_default(&self) -> bool {
        false
    }
    
    /// Initialize the module
    async fn initialize(&self, config: &Config) -> Result<()>;
    
    /// Register toolsets for this module
    async fn register_toolsets(&self) -> Result<()>;
}

/// Module registry for managing available modules
pub struct ModuleRegistry {
    modules: Vec<Box<dyn Module>>,
    config: Config,
}

impl ModuleRegistry {
    pub fn new(config: Config) -> Self {
        Self {
            modules: Vec::new(),
            config,
        }
    }
    
    /// Register a new module
    pub fn register_module(&mut self, module: Box<dyn Module>) {
        self.modules.push(module);
    }
    
    /// Get enabled modules based on configuration
    pub fn get_enabled_modules(&self) -> Vec<&dyn Module> {
        self.modules.iter()
            .filter(|module| {
                // Default modules are always enabled
                if module.is_default() {
                    return true;
                }
                
                // Check if module is in the enabled list
                self.config.enable_modules.contains(&module.id().to_string())
            })
            .map(|module| module.as_ref())
            .collect()
    }
    
    /// Initialize all enabled modules
    pub async fn initialize_modules(&self) -> Result<()> {
        let enabled_modules = self.get_enabled_modules();
        
        for module in enabled_modules {
            module.initialize(&self.config).await?;
        }
        
        Ok(())
    }
}