use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::Duration;

use crate::cli::{Cli, Commands};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum LogFormat {
    Text,
    Json,
}

impl std::str::FromStr for LogFormat {
    type Err = anyhow::Error;
    
    fn from_str(s: &str) -> Result<Self> {
        match s.to_lowercase().as_str() {
            "text" => Ok(LogFormat::Text),
            "json" => Ok(LogFormat::Json),
            _ => Err(anyhow::anyhow!("Invalid log format: {}", s)),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum TransportType {
    Stdio,
    Http,
}

#[derive(Debug, Clone)]
pub struct Config {
    // Common fields
    pub version: String,
    pub read_only: bool,
    pub toolsets: Vec<String>,
    pub enable_modules: Vec<String>,
    pub log_file_path: Option<PathBuf>,
    pub debug: bool,
    pub enable_license: bool,
    pub output_dir: Option<PathBuf>,
    pub log_format: LogFormat,
    
    // Transport configuration
    pub transport: TransportType,
    pub http_port: u16,
    pub http_path: String,
    
    // Mode configuration
    pub internal: bool,
    
    // External mode configuration
    pub base_url: Option<String>,
    pub account_id: Option<String>,
    pub default_org_id: Option<String>,
    pub default_project_id: Option<String>,
    pub api_key: Option<String>,
    
    // Internal mode configuration
    pub bearer_token: Option<String>,
    pub pipeline_svc_base_url: Option<String>,
    pub pipeline_svc_secret: Option<String>,
    pub ng_manager_base_url: Option<String>,
    pub ng_manager_secret: Option<String>,
    pub chatbot_base_url: Option<String>,
    pub chatbot_secret: Option<String>,
    pub genai_base_url: Option<String>,
    pub genai_secret: Option<String>,
    pub artifact_registry_base_url: Option<String>,
    pub artifact_registry_secret: Option<String>,
    pub nextgen_ce_base_url: Option<String>,
    pub nextgen_ce_secret: Option<String>,
    pub ccm_comm_orch_base_url: Option<String>,
    pub ccm_comm_orch_secret: Option<String>,
    pub idp_svc_base_url: Option<String>,
    pub idp_svc_secret: Option<String>,
    pub mcp_svc_secret: Option<String>,
    pub chaos_manager_svc_base_url: Option<String>,
    pub chaos_manager_svc_secret: Option<String>,
    pub template_svc_base_url: Option<String>,
    pub template_svc_secret: Option<String>,
    pub intelligence_svc_base_url: Option<String>,
    pub intelligence_svc_secret: Option<String>,
    pub code_svc_base_url: Option<String>,
    pub code_svc_secret: Option<String>,
    pub log_svc_base_url: Option<String>,
    pub log_svc_secret: Option<String>,
    pub dashboard_svc_base_url: Option<String>,
    pub dashboard_svc_secret: Option<String>,
    pub scs_svc_secret: Option<String>,
    pub scs_svc_base_url: Option<String>,
    pub sto_svc_secret: Option<String>,
    pub sto_svc_base_url: Option<String>,
    pub sei_svc_base_url: Option<String>,
    pub sei_svc_secret: Option<String>,
    pub audit_svc_base_url: Option<String>,
    pub audit_svc_secret: Option<String>,
    pub dbops_svc_base_url: Option<String>,
    pub dbops_svc_secret: Option<String>,
    pub acl_svc_base_url: Option<String>,
    pub acl_svc_secret: Option<String>,
    
    // License cache configuration
    pub license_cache_ttl: Duration,
    pub license_cache_clean_interval: Duration,
}

impl Config {
    pub fn from_cli(cli: &Cli) -> Result<Self> {
        let log_format = cli.log_format.parse()
            .context("Invalid log format")?;
        
        let toolsets = cli.toolsets.clone().unwrap_or_else(|| vec!["default".to_string()]);
        let enable_modules = cli.enable_modules.clone().unwrap_or_default();
        
        let mut config = Config {
            version: env!("CARGO_PKG_VERSION").to_string(),
            read_only: cli.read_only,
            toolsets,
            enable_modules,
            log_file_path: cli.log_file.clone(),
            debug: cli.debug,
            enable_license: cli.enable_license,
            output_dir: cli.output_dir.clone(),
            log_format,
            
            // Default transport and HTTP settings
            transport: TransportType::Stdio,
            http_port: 8080,
            http_path: "/mcp".to_string(),
            
            // Default to external mode
            internal: false,
            
            // Initialize all optional fields to None
            base_url: None,
            account_id: None,
            default_org_id: None,
            default_project_id: None,
            api_key: None,
            bearer_token: None,
            pipeline_svc_base_url: None,
            pipeline_svc_secret: None,
            ng_manager_base_url: None,
            ng_manager_secret: None,
            chatbot_base_url: None,
            chatbot_secret: None,
            genai_base_url: None,
            genai_secret: None,
            artifact_registry_base_url: None,
            artifact_registry_secret: None,
            nextgen_ce_base_url: None,
            nextgen_ce_secret: None,
            ccm_comm_orch_base_url: None,
            ccm_comm_orch_secret: None,
            idp_svc_base_url: None,
            idp_svc_secret: None,
            mcp_svc_secret: None,
            chaos_manager_svc_base_url: None,
            chaos_manager_svc_secret: None,
            template_svc_base_url: None,
            template_svc_secret: None,
            intelligence_svc_base_url: None,
            intelligence_svc_secret: None,
            code_svc_base_url: None,
            code_svc_secret: None,
            log_svc_base_url: None,
            log_svc_secret: None,
            dashboard_svc_base_url: None,
            dashboard_svc_secret: None,
            scs_svc_secret: None,
            scs_svc_base_url: None,
            sto_svc_secret: None,
            sto_svc_base_url: None,
            sei_svc_base_url: None,
            sei_svc_secret: None,
            audit_svc_base_url: None,
            audit_svc_secret: None,
            dbops_svc_base_url: None,
            dbops_svc_secret: None,
            acl_svc_base_url: None,
            acl_svc_secret: None,
            
            // Default license cache settings
            license_cache_ttl: Duration::from_secs(30 * 60), // 30 minutes
            license_cache_clean_interval: Duration::from_secs(5 * 60), // 5 minutes
        };
        
        // Configure based on command
        match &cli.command {
            Commands::Stdio { base_url, api_key, default_org_id, default_project_id } => {
                config.transport = TransportType::Stdio;
                config.internal = false;
                config.base_url = Some(base_url.clone());
                config.api_key = Some(api_key.clone());
                config.default_org_id = default_org_id.clone();
                config.default_project_id = default_project_id.clone();
                
                // Extract account ID from API key
                config.account_id = Some(extract_account_id_from_api_key(api_key)?);
            }
            Commands::HttpServer { http_port, http_path, .. } => {
                config.transport = TransportType::Http;
                config.internal = true;
                config.http_port = *http_port;
                config.http_path = http_path.clone();
                // TODO: Set internal service configurations
            }
            Commands::Internal { bearer_token, mcp_svc_secret, .. } => {
                config.transport = TransportType::Stdio;
                config.internal = true;
                config.read_only = true; // Internal mode is read-only for now
                config.bearer_token = Some(bearer_token.clone());
                config.mcp_svc_secret = Some(mcp_svc_secret.clone());
                // TODO: Set other internal service configurations
            }
        }
        
        Ok(config)
    }
}

/// Extract account ID from Harness API key
/// API key format: pat.ACCOUNT_ID.TOKEN_ID.<>
fn extract_account_id_from_api_key(api_key: &str) -> Result<String> {
    let parts: Vec<&str> = api_key.split('.').collect();
    if parts.len() < 2 {
        return Err(anyhow::anyhow!("Invalid API key format"));
    }
    Ok(parts[1].to_string())
}