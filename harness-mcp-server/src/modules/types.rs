//! Module system types and traits

use crate::{config::Config, tools::ToolsetGroup};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Module trait that all modules must implement
pub trait Module: Send + Sync {
    /// Get the module ID
    fn id(&self) -> &str;
    
    /// Get the module name
    fn name(&self) -> &str;
    
    /// Get the module description
    fn description(&self) -> &str;
    
    /// Get the toolsets this module provides
    fn toolsets(&self) -> Vec<String>;
    
    /// Check if this is a default module (always enabled)
    fn is_default(&self) -> bool {
        false
    }
    
    /// Check if this module requires a license
    fn requires_license(&self) -> bool {
        true
    }
    
    /// Get the license module ID for validation
    fn license_module_id(&self) -> Option<&str> {
        None
    }
    
    /// Initialize the module with configuration
    fn initialize(&self, config: &Config, toolset_group: &mut ToolsetGroup) -> Result<(), crate::error::ServerError>;
}

/// Module information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModuleInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub toolsets: Vec<String>,
    pub is_default: bool,
    pub requires_license: bool,
    pub license_module_id: Option<String>,
    pub enabled: bool,
}

/// Module registry for managing all available modules
pub struct ModuleRegistry {
    modules: HashMap<String, Box<dyn Module>>,
    config: Config,
    enabled_modules: Vec<String>,
}

impl ModuleRegistry {
    /// Create a new module registry
    pub fn new(config: Config) -> Self {
        Self {
            modules: HashMap::new(),
            config,
            enabled_modules: Vec::new(),
        }
    }

    /// Register a module
    pub fn register_module(&mut self, module: Box<dyn Module>) {
        let id = module.id().to_string();
        self.modules.insert(id, module);
    }

    /// Enable modules by ID
    pub fn enable_modules(&mut self, module_ids: &[String]) -> Result<(), crate::error::ServerError> {
        if module_ids.is_empty() || (module_ids.len() == 1 && module_ids[0] == "all") {
            // Enable all modules
            self.enabled_modules = self.modules.keys().cloned().collect();
        } else {
            // Enable specific modules
            for id in module_ids {
                if !self.modules.contains_key(id) {
                    return Err(crate::error::ServerError::Module(format!("Module '{}' not found", id)));
                }
                if !self.enabled_modules.contains(id) {
                    self.enabled_modules.push(id.clone());
                }
            }
        }

        // Always enable default modules
        for (id, module) in &self.modules {
            if module.is_default() && !self.enabled_modules.contains(id) {
                self.enabled_modules.push(id.clone());
            }
        }

        Ok(())
    }

    /// Get enabled modules
    pub fn get_enabled_modules(&self) -> Vec<&dyn Module> {
        self.enabled_modules.iter()
            .filter_map(|id| self.modules.get(id).map(|m| m.as_ref()))
            .collect()
    }

    /// Get all modules
    pub fn get_all_modules(&self) -> Vec<&dyn Module> {
        self.modules.values().map(|m| m.as_ref()).collect()
    }

    /// Get module by ID
    pub fn get_module(&self, id: &str) -> Option<&dyn Module> {
        self.modules.get(id).map(|m| m.as_ref())
    }

    /// Initialize all enabled modules
    pub fn initialize_modules(&self, toolset_group: &mut ToolsetGroup) -> Result<(), crate::error::ServerError> {
        for module in self.get_enabled_modules() {
            tracing::info!("Initializing module: {} ({})", module.name(), module.id());
            module.initialize(&self.config, toolset_group)?;
        }
        Ok(())
    }

    /// Get module information for all modules
    pub fn get_module_info(&self) -> Vec<ModuleInfo> {
        self.modules.iter().map(|(id, module)| {
            ModuleInfo {
                id: id.clone(),
                name: module.name().to_string(),
                description: module.description().to_string(),
                toolsets: module.toolsets(),
                is_default: module.is_default(),
                requires_license: module.requires_license(),
                license_module_id: module.license_module_id().map(|s| s.to_string()),
                enabled: self.enabled_modules.contains(id),
            }
        }).collect()
    }
}

/// License information for modules
#[derive(Debug, Clone)]
pub struct LicenseInfo {
    pub account_id: String,
    pub module_licenses: HashMap<String, bool>,
    pub is_valid: bool,
}

impl LicenseInfo {
    /// Create a new license info
    pub fn new(account_id: String) -> Self {
        Self {
            account_id,
            module_licenses: HashMap::new(),
            is_valid: false,
        }
    }

    /// Check if a module is licensed
    pub fn is_module_licensed(&self, module_id: &str) -> bool {
        if !self.is_valid {
            return false;
        }
        self.module_licenses.get(module_id).copied().unwrap_or(false)
    }

    /// Set module license status
    pub fn set_module_license(&mut self, module_id: String, licensed: bool) {
        self.module_licenses.insert(module_id, licensed);
    }
}

/// Filter enabled modules based on license information
pub fn filter_modules_by_license(
    modules: Vec<&dyn Module>,
    license_info: &LicenseInfo,
) -> Vec<&dyn Module> {
    modules.into_iter().filter(|module| {
        // Default modules are always enabled
        if module.is_default() {
            return true;
        }

        // If license is not valid, only allow default modules
        if !license_info.is_valid {
            return false;
        }

        // If module doesn't require license, allow it
        if !module.requires_license() {
            return true;
        }

        // Check specific module license
        if let Some(license_module_id) = module.license_module_id() {
            license_info.is_module_licensed(license_module_id)
        } else {
            // If no specific license module ID, check by module ID
            license_info.is_module_licensed(module.id())
        }
    }).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TestModule {
        id: String,
        name: String,
        is_default: bool,
    }

    impl Module for TestModule {
        fn id(&self) -> &str {
            &self.id
        }

        fn name(&self) -> &str {
            &self.name
        }

        fn description(&self) -> &str {
            "Test module"
        }

        fn toolsets(&self) -> Vec<String> {
            vec!["test".to_string()]
        }

        fn is_default(&self) -> bool {
            self.is_default
        }

        fn initialize(&self, _config: &Config, _toolset_group: &mut ToolsetGroup) -> Result<(), crate::error::ServerError> {
            Ok(())
        }
    }

    #[test]
    fn test_module_registry() {
        let config = Config::default();
        let mut registry = ModuleRegistry::new(config);

        let module = Box::new(TestModule {
            id: "test".to_string(),
            name: "Test Module".to_string(),
            is_default: false,
        });

        registry.register_module(module);
        assert_eq!(registry.modules.len(), 1);

        registry.enable_modules(&["test".to_string()]).unwrap();
        assert_eq!(registry.enabled_modules.len(), 1);
        assert!(registry.enabled_modules.contains(&"test".to_string()));
    }

    #[test]
    fn test_license_filtering() {
        let mut license_info = LicenseInfo::new("account123".to_string());
        license_info.is_valid = true;
        license_info.set_module_license("licensed_module".to_string(), true);

        let default_module = TestModule {
            id: "default".to_string(),
            name: "Default".to_string(),
            is_default: true,
        };

        let licensed_module = TestModule {
            id: "licensed_module".to_string(),
            name: "Licensed".to_string(),
            is_default: false,
        };

        let unlicensed_module = TestModule {
            id: "unlicensed_module".to_string(),
            name: "Unlicensed".to_string(),
            is_default: false,
        };

        let modules: Vec<&dyn Module> = vec![&default_module, &licensed_module, &unlicensed_module];
        let filtered = filter_modules_by_license(modules, &license_info);

        assert_eq!(filtered.len(), 2); // default + licensed
        assert!(filtered.iter().any(|m| m.id() == "default"));
        assert!(filtered.iter().any(|m| m.id() == "licensed_module"));
        assert!(!filtered.iter().any(|m| m.id() == "unlicensed_module"));
    }
}