use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::cli::{Cli, Commands};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    // Common fields
    pub version: String,
    pub read_only: bool,
    pub toolsets: Vec<String>,
    pub enable_modules: Vec<String>,
    pub log_file_path: Option<String>,
    pub debug: bool,
    pub enable_license: bool,
    pub internal: bool,

    // External mode fields
    pub base_url: String,
    pub account_id: String,
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
    pub fn load(cli: &Cli) -> Result<Self> {
        let mut config = Config {
            version: env!("CARGO_PKG_VERSION").to_string(),
            read_only: cli.read_only,
            toolsets: if cli.toolsets.is_empty() {
                vec!["default".to_string()]
            } else {
                cli.toolsets.clone()
            },
            enable_modules: cli.enable_modules.clone(),
            log_file_path: cli.log_file.clone(),
            debug: cli.debug,
            enable_license: cli.enable_license,
            internal: false,
            base_url: String::new(),
            account_id: String::new(),
            default_org_id: None,
            default_project_id: None,
            api_key: None,
            bearer_token: None,
            service_configs: HashMap::new(),
        };

        match &cli.command {
            Commands::Stdio {
                base_url,
                api_key,
                default_org_id,
                default_project_id,
            } => {
                config.base_url = base_url.clone();
                config.api_key = Some(api_key.clone());
                config.default_org_id = default_org_id.clone();
                config.default_project_id = default_project_id.clone();
                config.account_id = extract_account_id_from_api_key(api_key)?;
                config.internal = false;
            }
            Commands::Internal {
                bearer_token,
                mcp_svc_secret,
                pipeline_svc_base_url,
                pipeline_svc_secret,
                ng_manager_base_url,
                ng_manager_secret,
            } => {
                config.bearer_token = Some(bearer_token.clone());
                config.internal = true;
                config.read_only = true; // Internal mode is read-only for now

                // Add service configurations
                if let (Some(url), Some(secret)) = (pipeline_svc_base_url, pipeline_svc_secret) {
                    config.service_configs.insert(
                        "pipeline".to_string(),
                        ServiceConfig {
                            base_url: url.clone(),
                            secret: secret.clone(),
                        },
                    );
                }

                if let (Some(url), Some(secret)) = (ng_manager_base_url, ng_manager_secret) {
                    config.service_configs.insert(
                        "ng_manager".to_string(),
                        ServiceConfig {
                            base_url: url.clone(),
                            secret: secret.clone(),
                        },
                    );
                }

                config.service_configs.insert(
                    "mcp".to_string(),
                    ServiceConfig {
                        base_url: String::new(), // Will be set from context
                        secret: mcp_svc_secret.clone(),
                    },
                );
            }
        }

        Ok(config)
    }

    pub fn get_service_config(&self, service: &str) -> Option<&ServiceConfig> {
        self.service_configs.get(service)
    }
}

/// Extract account ID from Harness API key
/// API key format: pat.ACCOUNT_ID.TOKEN_ID.<>
fn extract_account_id_from_api_key(api_key: &str) -> Result<String> {
    let parts: Vec<&str> = api_key.split('.').collect();
    if parts.len() < 2 {
        return Err(anyhow!("Invalid API key format"));
    }
    Ok(parts[1].to_string())
}