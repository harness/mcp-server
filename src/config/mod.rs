use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub transport: TransportConfig,
    pub auth: AuthConfig,
    pub harness: HarnessConfig,
    pub toolsets: Vec<String>,
    pub modules: Vec<String>,
    pub debug: bool,
    pub read_only: bool,
    pub services: HashMap<String, ServiceConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TransportConfig {
    Stdio,
    Http { port: u16, path: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AuthConfig {
    ApiKey {
        api_key: String,
        account_id: Option<String>,
    },
    Bearer {
        token: String,
        mcp_svc_secret: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HarnessConfig {
    pub base_url: String,
    pub account_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceConfig {
    pub base_url: String,
    pub secret: Option<String>,
}

impl Config {
    pub fn new_stdio(
        api_key: Option<String>,
        account_id: Option<String>,
        base_url: String,
        debug: bool,
        read_only: bool,
        toolsets: String,
        enable_modules: String,
    ) -> Result<Self> {
        let api_key = api_key.context("API key is required for stdio mode")?;
        
        Ok(Config {
            transport: TransportConfig::Stdio,
            auth: AuthConfig::ApiKey { api_key, account_id: account_id.clone() },
            harness: HarnessConfig { base_url, account_id },
            toolsets: parse_comma_separated(&toolsets),
            modules: parse_comma_separated(&enable_modules),
            debug,
            read_only,
            services: HashMap::new(),
        })
    }
    
    pub fn new_http(
        port: u16,
        path: String,
        api_key: Option<String>,
        account_id: Option<String>,
        base_url: String,
        debug: bool,
        read_only: bool,
        toolsets: String,
        enable_modules: String,
    ) -> Result<Self> {
        let api_key = api_key.context("API key is required for HTTP mode")?;
        
        Ok(Config {
            transport: TransportConfig::Http { port, path },
            auth: AuthConfig::ApiKey { api_key, account_id: account_id.clone() },
            harness: HarnessConfig { base_url, account_id },
            toolsets: parse_comma_separated(&toolsets),
            modules: parse_comma_separated(&enable_modules),
            debug,
            read_only,
            services: HashMap::new(),
        })
    }
    
    pub fn new_internal(
        bearer_token: Option<String>,
        mcp_svc_secret: Option<String>,
        port: u16,
        path: String,
        debug: bool,
        read_only: bool,
        toolsets: String,
        enable_modules: String,
        pipeline_service_base_url: Option<String>,
        pipeline_service_secret: Option<String>,
        ng_manager_base_url: Option<String>,
        ng_manager_secret: Option<String>,
    ) -> Result<Self> {
        let bearer_token = bearer_token.context("Bearer token is required for internal mode")?;
        let mcp_svc_secret = mcp_svc_secret.context("MCP service secret is required for internal mode")?;
        
        let mut services = HashMap::new();
        
        if let Some(url) = pipeline_service_base_url {
            services.insert("pipeline".to_string(), ServiceConfig {
                base_url: url,
                secret: pipeline_service_secret,
            });
        }
        
        if let Some(url) = ng_manager_base_url {
            services.insert("ng_manager".to_string(), ServiceConfig {
                base_url: url,
                secret: ng_manager_secret,
            });
        }
        
        Ok(Config {
            transport: TransportConfig::Http { port, path },
            auth: AuthConfig::Bearer { token: bearer_token, mcp_svc_secret },
            harness: HarnessConfig { base_url: "".to_string(), account_id: None },
            toolsets: parse_comma_separated(&toolsets),
            modules: parse_comma_separated(&enable_modules),
            debug,
            read_only,
            services,
        })
    }
    
    pub fn is_module_enabled(&self, module: &str) -> bool {
        self.modules.contains(&module.to_string()) || self.modules.contains(&"core".to_string())
    }
    
    pub fn is_toolset_enabled(&self, toolset: &str) -> bool {
        self.toolsets.contains(&toolset.to_string()) || self.toolsets.contains(&"default".to_string())
    }
    
    pub fn get_service_config(&self, service: &str) -> Option<&ServiceConfig> {
        self.services.get(service)
    }
}

fn parse_comma_separated(input: &str) -> Vec<String> {
    input
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect()
}