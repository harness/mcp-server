use crate::config::Config;

/// Module registry for managing enabled modules and their toolsets
pub struct ModuleRegistry {
    config: Config,
}

impl ModuleRegistry {
    /// Create a new module registry
    pub fn new(config: Config) -> Self {
        Self { config }
    }

    /// Get the list of enabled modules
    pub fn get_enabled_modules(&self) -> Vec<String> {
        self.config.enable_modules.clone()
    }

    /// Check if a module is enabled
    pub fn is_module_enabled(&self, module: &str) -> bool {
        self.config.is_module_enabled(module)
    }
}