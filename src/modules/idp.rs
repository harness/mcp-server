use anyhow::Result;
use crate::config::Config;
use crate::modules::Module;

pub struct IdpModule;

impl Module for IdpModule {
    fn name(&self) -> &'static str { "idp" }
    fn description(&self) -> &'static str { "Internal Developer Portal functionality" }
    fn is_enabled(&self, config: &Config) -> bool { config.toolsets.contains("idp") }
    fn initialize(&mut self, _config: &Config) -> Result<()> { Ok(()) }
}