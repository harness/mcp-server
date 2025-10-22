//! Configuration management for Harness MCP Server

pub mod environment;

pub use environment::{Environment, load_dotenv};

use anyhow::Result;
use figment::{
    providers::{Env, Format, Yaml},
    Figment,
};
use serde::{Deserialize, Serialize};
use std::path::Path;

/// Transport type for the server
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TransportType {
    Http,
    Stdio,
}

/// Log format type
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogFormat {
    Text,
    Json,
}

/// HTTP server configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpConfig {
    pub port: u16,
    pub path: String,
}

/// Metrics server configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricsConfig {
    pub port: u16,
}

/// Main configuration structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    /// Server version
    pub version: String,
    
    /// Transport type
    pub transport: TransportType,
    
    /// HTTP configuration
    pub http: HttpConfig,
    
    /// Metrics configuration
    pub metrics: MetricsConfig,
    
    /// Enable debug logging
    pub debug: bool,
    
    /// Log format
    pub log_format: LogFormat,
    
    /// Read-only mode
    pub read_only: bool,
    
    /// Internal mode (for internal Harness usage)
    pub internal: bool,
    
    /// Enabled toolsets
    pub toolsets: Vec<String>,
    
    /// Enabled modules
    pub enable_modules: Vec<String>,
    
    /// Enable license validation
    pub enable_license: bool,
    
    /// Output directory for files
    pub output_dir: Option<String>,
    
    /// Log file path
    pub log_file: Option<String>,
    
    // External mode configuration
    /// API key for authentication
    pub api_key: Option<String>,
    
    /// Base URL for Harness
    pub base_url: String,
    
    /// Account ID
    pub account_id: Option<String>,
    
    /// Default organization ID
    pub default_org_id: Option<String>,
    
    /// Default project ID
    pub default_project_id: Option<String>,
    
    // Internal mode configuration
    /// Bearer token for internal authentication
    pub bearer_token: Option<String>,
    
    /// Service URLs and secrets for internal mode
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
}

impl Default for Config {
    fn default() -> Self {
        Self {
            version: crate::VERSION.to_string(),
            transport: TransportType::Stdio,
            http: HttpConfig {
                port: 8080,
                path: "/mcp".to_string(),
            },
            metrics: MetricsConfig {
                port: 8889,
            },
            debug: false,
            log_format: LogFormat::Text,
            read_only: false,
            internal: false,
            toolsets: vec!["default".to_string()],
            enable_modules: vec![],
            enable_license: false,
            output_dir: None,
            log_file: None,
            api_key: None,
            base_url: "https://app.harness.io".to_string(),
            account_id: None,
            default_org_id: None,
            default_project_id: None,
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
        }
    }
}

impl Config {
    /// Load configuration from file and environment variables
    pub fn load(config_path: Option<&str>) -> Result<Self> {
        let mut figment = Figment::new();

        // Load from config file if provided
        if let Some(path) = config_path {
            if Path::new(path).exists() {
                figment = figment.merge(Yaml::file(path));
            }
        }

        // Load from environment variables with HARNESS_ prefix
        figment = figment.merge(Env::prefixed("HARNESS_"));

        // Load .env file if it exists
        if let Err(e) = dotenvy::dotenv() {
            tracing::debug!("No .env file found or failed to load: {}", e);
        }

        let config: Config = figment.extract()?;
        Ok(config)
    }

    /// Extract account ID from API key
    pub fn extract_account_id(&mut self) -> Result<()> {
        if let Some(api_key) = &self.api_key {
            let parts: Vec<&str> = api_key.split('.').collect();
            if parts.len() >= 2 {
                self.account_id = Some(parts[1].to_string());
            } else {
                return Err(anyhow::anyhow!("Invalid API key format"));
            }
        }
        Ok(())
    }
}