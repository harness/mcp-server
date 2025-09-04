use anyhow::Result;
use crate::config::Config;
use crate::modules::Module;

pub struct RegistryModule;

impl Module for RegistryModule {
    fn name(&self) -> &'static str { "registry" }
    fn description(&self) -> &'static str { "Artifact Registry functionality" }
    fn is_enabled(&self, config: &Config) -> bool { config.toolsets.contains("registries") }
    fn initialize(&mut self, _config: &Config) -> Result<()> { Ok(()) }
}