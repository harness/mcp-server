//! Modules system for organizing tools and functionality

use crate::{config::Config, tools::ToolRegistry, Result};

/// Module trait that all modules must implement
pub trait Module: Send + Sync {
    /// Get the module ID
    fn id(&self) -> &str;
    
    /// Get the module name
    fn name(&self) -> &str;
    
    /// Check if this is a default module
    fn is_default(&self) -> bool;
    
    /// Register tools for this module
    fn register_tools(&self, registry: &mut ToolRegistry, config: &Config) -> Result<()>;
}

/// Module registry for managing available modules
pub struct ModuleRegistry {
    modules: std::collections::HashMap<String, Box<dyn Module>>,
    config: Config,
}

impl ModuleRegistry {
    /// Create a new module registry
    pub fn new(config: Config) -> Self {
        let mut registry = Self {
            modules: std::collections::HashMap::new(),
            config,
        };
        
        // Register default modules
        registry.register_default_modules();
        
        registry
    }
    
    /// Register a module
    pub fn register(&mut self, module: Box<dyn Module>) {
        self.modules.insert(module.id().to_string(), module);
    }
    
    /// Get enabled modules based on configuration
    pub fn get_enabled_modules(&self) -> Vec<&dyn Module> {
        if self.config.enable_modules.is_empty() {
            // Return default modules
            self.modules
                .values()
                .filter(|m| m.is_default())
                .map(|m| m.as_ref())
                .collect()
        } else {
            // Return configured modules
            self.config
                .enable_modules
                .iter()
                .filter_map(|id| self.modules.get(id).map(|m| m.as_ref()))
                .collect()
        }
    }
    
    /// Register tools from all enabled modules
    pub fn register_tools(&self, tool_registry: &mut ToolRegistry) -> Result<()> {
        for module in self.get_enabled_modules() {
            module.register_tools(tool_registry, &self.config)?;
        }
        Ok(())
    }
    
    /// Register default modules
    fn register_default_modules(&mut self) {
        // TODO: Register actual modules
        // self.register(Box::new(CoreModule::new()));
        // self.register(Box::new(PipelinesModule::new()));
        // etc.
    }
}

/// Core module (always enabled)
pub struct CoreModule;

impl CoreModule {
    pub fn new() -> Self {
        Self
    }
}

impl Module for CoreModule {
    fn id(&self) -> &str {
        "CORE"
    }
    
    fn name(&self) -> &str {
        "Core"
    }
    
    fn is_default(&self) -> bool {
        true
    }
    
    fn register_tools(&self, registry: &mut ToolRegistry, _config: &Config) -> Result<()> {
        // Register core tools
        registry.register(Box::new(crate::tools::connectors::GetConnectorDetailsTool::new()));
        registry.register(Box::new(crate::tools::connectors::ListConnectorCatalogueTool::new()));
        registry.register(Box::new(crate::tools::pipelines::GetPipelineTool::new()));
        registry.register(Box::new(crate::tools::pipelines::ListPipelinesTool::new()));
        registry.register(Box::new(crate::tools::dashboards::ListDashboardsTool::new()));
        registry.register(Box::new(crate::tools::dashboards::GetDashboardDataTool::new()));
        
        Ok(())
    }
}