use anyhow::Result;
use crate::config::Config;
use crate::modules::Module;

pub struct ScsModule;

impl Module for ScsModule {
    fn name(&self) -> &'static str { "scs" }
    fn description(&self) -> &'static str { "Supply Chain Security functionality" }
    fn is_enabled(&self, config: &Config) -> bool { config.toolsets.contains("scs") }
    fn initialize(&mut self, _config: &Config) -> Result<()> { Ok(()) }
}