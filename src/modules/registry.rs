use anyhow::Result;
use serde_json::Value;
use std::collections::HashMap;
use tracing::{info, debug};

use crate::config::Config;

pub struct ModuleRegistry {
    config: Config,
    prompts: HashMap<String, String>,
}

impl ModuleRegistry {
    pub fn new(config: &Config) -> Result<Self> {
        let mut registry = Self {
            config: config.clone(),
            prompts: HashMap::new(),
        };

        registry.register_modules()?;
        Ok(registry)
    }

    fn register_modules(&mut self) -> Result<()> {
        info!("Registering modules: {:?}", self.config.enable_modules);

        for module in &self.config.enable_modules {
            match module.as_str() {
                "CORE" => self.register_core_module()?,
                "CCM" => self.register_ccm_module()?,
                "CD" => self.register_cd_module()?,
                "CI" => self.register_ci_module()?,
                "CODE" => self.register_code_module()?,
                "CHAOS" => self.register_chaos_module()?,
                "IDP" => self.register_idp_module()?,
                "STO" => self.register_sto_module()?,
                "SSCA" => self.register_ssca_module()?,
                _ => {
                    debug!("Unknown module: {}", module);
                }
            }
        }

        info!("Registered {} prompts", self.prompts.len());
        Ok(())
    }

    fn register_core_module(&mut self) -> Result<()> {
        debug!("Registering core module");
        // TODO: Load core prompts
        Ok(())
    }

    fn register_ccm_module(&mut self) -> Result<()> {
        debug!("Registering CCM module");
        // TODO: Load CCM prompts
        Ok(())
    }

    fn register_cd_module(&mut self) -> Result<()> {
        debug!("Registering CD module");
        // TODO: Load CD prompts
        Ok(())
    }

    fn register_ci_module(&mut self) -> Result<()> {
        debug!("Registering CI module");
        // TODO: Load CI prompts
        Ok(())
    }

    fn register_code_module(&mut self) -> Result<()> {
        debug!("Registering CODE module");
        // TODO: Load CODE prompts
        Ok(())
    }

    fn register_chaos_module(&mut self) -> Result<()> {
        debug!("Registering CHAOS module");
        // TODO: Load CHAOS prompts
        Ok(())
    }

    fn register_idp_module(&mut self) -> Result<()> {
        debug!("Registering IDP module");
        // TODO: Load IDP prompts
        Ok(())
    }

    fn register_sto_module(&mut self) -> Result<()> {
        debug!("Registering STO module");
        // TODO: Load STO prompts
        Ok(())
    }

    fn register_ssca_module(&mut self) -> Result<()> {
        debug!("Registering SSCA module");
        // TODO: Load SSCA prompts
        Ok(())
    }

    pub async fn list_prompts(&self) -> Result<Vec<Value>> {
        let mut prompts = Vec::new();
        
        for (name, content) in &self.prompts {
            prompts.push(serde_json::json!({
                "name": name,
                "description": format!("Prompt for {}", name)
            }));
        }

        Ok(prompts)
    }

    pub async fn get_prompt(&self, params: &Value) -> Result<Value> {
        let name = params.get("name")
            .and_then(|n| n.as_str())
            .ok_or_else(|| anyhow::anyhow!("Missing prompt name"))?;

        let content = self.prompts.get(name)
            .ok_or_else(|| anyhow::anyhow!("Prompt not found: {}", name))?;

        Ok(serde_json::json!({
            "description": format!("Prompt for {}", name),
            "messages": [
                {
                    "role": "user",
                    "content": {
                        "type": "text",
                        "text": content
                    }
                }
            ]
        }))
    }
}