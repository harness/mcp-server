// Harness modules for different services

pub mod core;
pub mod ccm;
pub mod ci;
pub mod cd;
pub mod code;
pub mod chaos;
pub mod sto;
pub mod scs;
pub mod idp;
pub mod registry;

use anyhow::Result;
use std::collections::HashSet;

use crate::config::Config;

pub trait Module {
    fn name(&self) -> &'static str;
    fn description(&self) -> &'static str;
    fn is_enabled(&self, config: &Config) -> bool;
    fn initialize(&mut self, config: &Config) -> Result<()>;
}

pub struct ModuleRegistry {
    modules: Vec<Box<dyn Module>>,
}

impl ModuleRegistry {
    pub fn new() -> Self {
        Self {
            modules: Vec::new(),
        }
    }

    pub fn register_module(&mut self, module: Box<dyn Module>) {
        self.modules.push(module);
    }

    pub fn initialize_enabled_modules(&mut self, config: &Config) -> Result<()> {
        for module in &mut self.modules {
            if module.is_enabled(config) {
                module.initialize(config)?;
            }
        }
        Ok(())
    }

    pub fn get_enabled_modules(&self, config: &Config) -> Vec<&dyn Module> {
        self.modules
            .iter()
            .filter(|m| m.is_enabled(config))
            .map(|m| m.as_ref())
            .collect()
    }
}

impl Default for ModuleRegistry {
    fn default() -> Self {
        Self::new()
    }
}