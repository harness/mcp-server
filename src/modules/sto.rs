use anyhow::Result;
use crate::config::Config;
use crate::modules::Module;

pub struct StoModule;

impl Module for StoModule {
    fn name(&self) -> &'static str { "sto" }
    fn description(&self) -> &'static str { "Security Test Orchestration functionality" }
    fn is_enabled(&self, config: &Config) -> bool { config.toolsets.contains("sto") }
    fn initialize(&mut self, _config: &Config) -> Result<()> { Ok(()) }
}