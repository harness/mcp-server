// Continuous Integration module

use anyhow::Result;
use crate::config::Config;
use crate::modules::Module;

pub struct CiModule;

impl Module for CiModule {
    fn name(&self) -> &'static str { "ci" }
    fn description(&self) -> &'static str { "Continuous Integration functionality" }
    fn is_enabled(&self, config: &Config) -> bool { config.toolsets.contains("ci") }
    fn initialize(&mut self, _config: &Config) -> Result<()> { Ok(()) }
}