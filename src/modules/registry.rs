//! Module registry for managing available modules

use crate::{
    config::Config,
    modules::{
        ccm::CCMModule, cd::CDModule, chaos::CHAOSModule, ci::CIModule, code::CODEModule,
        core::CoreModule, dbops::DbOpsModule, har::HARModule, idp::IDPModule, sei::SEIModule,
        ssca::SSCAModule, sto::STOModule, unlicensed::UnlicensedModule, Module,
    },
    tools::ToolRegistry,
    Result,
};
use std::collections::HashMap;
use tracing::info;

/// Module registry holding all available modules
pub struct ModuleRegistry {
    modules: Vec<Box<dyn Module>>,
    config: Config,
}

impl ModuleRegistry {
    /// Create a new module registry with all available modules
    pub fn new(config: Config) -> Self {
        let modules: Vec<Box<dyn Module>> = vec![
            Box::new(CoreModule::new(config.clone())),
            Box::new(CIModule::new(config.clone())),
            Box::new(CDModule::new(config.clone())),
            Box::new(UnlicensedModule::new(config.clone())),
            Box::new(CHAOSModule::new(config.clone())),
            Box::new(SEIModule::new(config.clone())),
            Box::new(STOModule::new(config.clone())),
            Box::new(SSCAModule::new(config.clone())),
            Box::new(CODEModule::new(config.clone())),
            Box::new(CCMModule::new(config.clone())),
            Box::new(IDPModule::new(config.clone())),
            Box::new(HARModule::new(config.clone())),
            Box::new(DbOpsModule::new(config.clone())),
        ];

        Self { modules, config }
    }

    /// Get all available modules
    pub fn get_all_modules(&self) -> &[Box<dyn Module>] {
        &self.modules
    }

    /// Get enabled modules based on configuration
    pub fn get_enabled_modules(&self) -> Vec<&dyn Module> {
        // If no specific modules are enabled, return all default modules
        if self.config.enable_modules.is_empty() {
            return self
                .modules
                .iter()
                .filter(|m| m.is_default())
                .map(|m| m.as_ref())
                .collect();
        }

        // Create a map for quick lookup of enabled module IDs
        let enabled_module_ids: HashMap<String, bool> = self
            .config
            .enable_modules
            .iter()
            .map(|id| (id.clone(), true))
            .collect();

        // Check if "all" is enabled
        if enabled_module_ids.contains_key("all") {
            return self.modules.iter().map(|m| m.as_ref()).collect();
        }

        // Always enable CORE module
        let mut enabled_modules = Vec::new();
        for module in &self.modules {
            if module.id() == "CORE" || enabled_module_ids.contains_key(module.id()) {
                enabled_modules.push(module.as_ref());
            }
        }

        enabled_modules
    }

    /// Register tools from all enabled modules
    pub async fn register_tools(&self, tool_registry: &mut ToolRegistry) -> Result<()> {
        let enabled_modules = self.get_enabled_modules();

        for module in enabled_modules {
            info!("Registering tools for module: {}", module.id());
            module.register_tools(tool_registry).await?;
        }

        Ok(())
    }

    /// Register prompts for enabled modules (placeholder for future implementation)
    pub async fn register_prompts(&self) -> Result<()> {
        let enabled_modules = self.get_enabled_modules();

        for module in enabled_modules {
            info!("Registering prompts for module: {}", module.id());
            // TODO: Implement prompt registration when MCP protocol is available
        }

        Ok(())
    }
}