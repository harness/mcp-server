use anyhow::Result;
use crate::config::Config;
use crate::modules::Module;

pub struct ChaosModule;

impl Module for ChaosModule {
    fn name(&self) -> &'static str { "chaos" }
    fn description(&self) -> &'static str { "Chaos Engineering functionality" }
    fn is_enabled(&self, config: &Config) -> bool { config.toolsets.contains("chaos") }
    fn initialize(&mut self, _config: &Config) -> Result<()> { Ok(()) }
}