use anyhow::Result;
use std::collections::HashMap;

use crate::config::Config;

pub trait Module: Send + Sync {
    fn name(&self) -> &str;
    fn is_enabled(&self, config: &Config) -> bool;
    fn register_toolsets(&self) -> Vec<String>;
}

pub struct ModuleRegistry {
    modules: HashMap<String, Box<dyn Module>>,
}

impl ModuleRegistry {
    pub fn new() -> Self {
        Self {
            modules: HashMap::new(),
        }
    }
    
    pub fn register_module(&mut self, module: Box<dyn Module>) {
        let name = module.name().to_string();
        self.modules.insert(name, module);
    }
    
    pub fn get_enabled_modules(&self, config: &Config) -> Vec<&dyn Module> {
        self.modules
            .values()
            .filter(|module| module.is_enabled(config))
            .map(|module| module.as_ref())
            .collect()
    }
}

// Core module (always enabled)
pub struct CoreModule;

impl Module for CoreModule {
    fn name(&self) -> &str {
        "core"
    }
    
    fn is_enabled(&self, _config: &Config) -> bool {
        true // Core module is always enabled
    }
    
    fn register_toolsets(&self) -> Vec<String> {
        vec![
            "pipelines".to_string(),
            "dashboards".to_string(),
            "repositories".to_string(),
        ]
    }
}