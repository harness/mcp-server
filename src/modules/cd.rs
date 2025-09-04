// Continuous Deployment module

use anyhow::Result;
use crate::config::Config;
use crate::modules::Module;

pub struct CdModule;

impl Module for CdModule {
    fn name(&self) -> &'static str { "cd" }
    fn description(&self) -> &'static str { "Continuous Deployment functionality" }
    fn is_enabled(&self, config: &Config) -> bool { config.toolsets.contains("cd") }
    fn initialize(&mut self, _config: &Config) -> Result<()> { Ok(()) }
}