// Code repository module

use anyhow::Result;
use crate::config::Config;
use crate::modules::Module;

pub struct CodeModule;

impl Module for CodeModule {
    fn name(&self) -> &'static str { "code" }
    fn description(&self) -> &'static str { "Code repository functionality" }
    fn is_enabled(&self, config: &Config) -> bool { 
        config.toolsets.contains("code") || 
        config.toolsets.contains("repositories") ||
        config.toolsets.contains("pullrequests")
    }
    fn initialize(&mut self, _config: &Config) -> Result<()> { Ok(()) }
}