use crate::toolsets::ToolsetGroup;
use crate::types::HarnessError;
use crate::types::traits::Module;

pub use crate::types::traits::module_enable_toolsets;

/// Registry for managing modules
pub struct ModuleRegistry {
    modules: Vec<Box<dyn Module>>,
}

impl ModuleRegistry {
    pub fn new() -> Self {
        Self {
            modules: Vec::new(),
        }
    }

    /// Add a module to the registry
    pub fn add_module(&mut self, module: Box<dyn Module>) {
        self.modules.push(module);
    }

    /// Get all modules
    pub fn modules(&self) -> &[Box<dyn Module>] {
        &self.modules
    }

    /// Get modules by IDs
    pub fn get_modules_by_ids(&self, ids: &[String]) -> Vec<&dyn Module> {
        if ids.is_empty() || ids.contains(&"all".to_string()) {
            return self.modules.iter().map(|m| m.as_ref()).collect();
        }

        self.modules
            .iter()
            .filter(|module| ids.contains(&module.id().to_string()))
            .map(|m| m.as_ref())
            .collect()
    }

    /// Get default modules
    pub fn get_default_modules(&self) -> Vec<&dyn Module> {
        self.modules
            .iter()
            .filter(|module| module.is_default())
            .map(|m| m.as_ref())
            .collect()
    }
}

impl Default for ModuleRegistry {
    fn default() -> Self {
        Self::new()
    }
}