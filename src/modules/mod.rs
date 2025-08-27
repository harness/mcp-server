pub mod core;
pub mod ccm;
pub mod ci;
pub mod cd;
pub mod sto;
pub mod chaos;

use crate::config::Config;
use crate::error::Result;

/// Module trait for different Harness service integrations
pub trait Module {
    fn id(&self) -> &str;
    fn is_default(&self) -> bool;
    fn register_tools(&self, config: &Config) -> Result<Vec<crate::tools::Tool>>;
}

/// Initialize modules based on configuration
pub fn initialize_modules(config: &Config) -> Result<Vec<Box<dyn Module>>> {
    let mut modules: Vec<Box<dyn Module>> = Vec::new();

    // Always include core module
    modules.push(Box::new(core::CoreModule));

    // Add modules based on configuration
    for module_name in &config.enable_modules {
        match module_name.as_str() {
            "CCM" => modules.push(Box::new(ccm::CcmModule)),
            "CI" => modules.push(Box::new(ci::CiModule)),
            "CD" => modules.push(Box::new(cd::CdModule)),
            "STO" => modules.push(Box::new(sto::StoModule)),
            "CHAOS" => modules.push(Box::new(chaos::ChaosModule)),
            _ => {
                tracing::warn!("Unknown module: {}", module_name);
            }
        }
    }

    Ok(modules)
}