use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::{McpError, Result};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    // Common fields
    pub version: String,
    pub read_only: bool,
    pub toolsets: Vec<String>,
    pub enable_modules: Vec<String>,
    pub enable_license: bool,
    pub debug: bool,
    pub internal_mode: bool,
    
    // External mode fields
    pub base_url: Option<String>,
    pub account_id: Option<String>,
    pub default_org_id: Option<String>,
    pub default_project_id: Option<String>,
    pub api_key: Option<String>,
    
    // Internal mode fields
    pub bearer_token: Option<String>,
    pub service_configs: HashMap<String, ServiceConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceConfig {
    pub base_url: String,
    pub secret: String,
}

impl Config {
    pub fn builder() -> ConfigBuilder {
        ConfigBuilder::default()
    }
    
    pub fn extract_account_id_from_api_key(&mut self) -> Result<()> {
        if let Some(api_key) = &self.api_key {
            let parts: Vec<&str> = api_key.split('.').collect();
            if parts.len() < 2 {
                return Err(McpError::config("Invalid API key format"));
            }
            self.account_id = Some(parts[1].to_string());
        }
        Ok(())
    }
    
    pub fn validate(&self) -> Result<()> {
        if self.internal_mode {
            if self.bearer_token.is_none() {
                return Err(McpError::config("Bearer token required for internal mode"));
            }
        } else {
            if self.api_key.is_none() {
                return Err(McpError::config("API key required for external mode"));
            }
            if self.base_url.is_none() {
                return Err(McpError::config("Base URL required for external mode"));
            }
        }
        Ok(())
    }
}

#[derive(Default)]
pub struct ConfigBuilder {
    config: Config,
}

impl ConfigBuilder {
    pub fn new() -> Self {
        Self {
            config: Config {
                version: crate::VERSION.to_string(),
                read_only: false,
                toolsets: vec!["default".to_string()],
                enable_modules: Vec::new(),
                enable_license: false,
                debug: false,
                internal_mode: false,
                base_url: None,
                account_id: None,
                default_org_id: None,
                default_project_id: None,
                api_key: None,
                bearer_token: None,
                service_configs: HashMap::new(),
            },
        }
    }
    
    pub fn base_url<S: Into<String>>(mut self, base_url: S) -> Self {
        self.config.base_url = Some(base_url.into());
        self
    }
    
    pub fn api_key<S: Into<String>>(mut self, api_key: S) -> Self {
        self.config.api_key = Some(api_key.into());
        self
    }
    
    pub fn default_org_id<S: Into<String>>(mut self, org_id: Option<S>) -> Self {
        self.config.default_org_id = org_id.map(|s| s.into());
        self
    }
    
    pub fn default_project_id<S: Into<String>>(mut self, project_id: Option<S>) -> Self {
        self.config.default_project_id = project_id.map(|s| s.into());
        self
    }
    
    pub fn toolsets(mut self, toolsets: Vec<String>) -> Self {
        if !toolsets.is_empty() {
            self.config.toolsets = toolsets;
        }
        self
    }
    
    pub fn enable_modules(mut self, modules: Vec<String>) -> Self {
        self.config.enable_modules = modules;
        self
    }
    
    pub fn enable_license(mut self, enable: bool) -> Self {
        self.config.enable_license = enable;
        self
    }
    
    pub fn read_only(mut self, read_only: bool) -> Self {
        self.config.read_only = read_only;
        self
    }
    
    pub fn debug(mut self, debug: bool) -> Self {
        self.config.debug = debug;
        self
    }
    
    pub fn internal_mode(mut self, internal: bool) -> Self {
        self.config.internal_mode = internal;
        self
    }
    
    pub fn bearer_token<S: Into<String>>(mut self, token: S) -> Self {
        self.config.bearer_token = Some(token.into());
        self
    }
    
    pub fn service_config<S: Into<String>>(mut self, name: S, config: ServiceConfig) -> Self {
        self.config.service_configs.insert(name.into(), config);
        self
    }
    
    pub fn build(mut self) -> Result<Config> {
        self.config.extract_account_id_from_api_key()?;
        self.config.validate()?;
        Ok(self.config)
    }
}

impl Default for ConfigBuilder {
    fn default() -> Self {
        Self::new()
    }
}