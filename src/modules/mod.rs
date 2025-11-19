use crate::config::Config;
use crate::toolsets::ToolsetGroup;

pub mod traits;
pub use traits::*;

#[derive(Clone)]
pub struct ModuleRegistry {
    config: Config,
}

impl ModuleRegistry {
    pub fn new(config: &Config, _toolsets: &ToolsetGroup) -> Self {
        Self {
            config: config.clone(),
        }
    }
}