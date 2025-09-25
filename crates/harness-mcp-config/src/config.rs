//! Configuration management for Harness MCP Server

use crate::error::{Error, Result};
use figment::{
    providers::{Env, Format, Toml, Yaml},
    Figment,
};
use serde::{Deserialize, Serialize};

/// Main configuration structure matching Go implementation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    /// Version information
    #[serde(default = "default_version")]
    pub version: String,
    
    /// Read-only mode
    #[serde(default)]
    pub read_only: bool,
    
    /// Enabled toolsets
    #[serde(default = "default_toolsets")]
    pub toolsets: Vec<String>,
    
    /// Enabled modules
    #[serde(default)]
    pub enable_modules: Vec<String>,
    
    /// Log file path
    pub log_file_path: Option<String>,
    
    /// Debug mode
    #[serde(default)]
    pub debug: bool,
    
    /// Enable license validation
    #[serde(default)]
    pub enable_license: bool,
    
    /// Output directory
    pub output_dir: Option<String>,
    
    /// Transport type
    #[serde(default)]
    pub transport: TransportType,
    
    /// HTTP configuration
    pub http: HttpConfig,
    
    /// Internal mode flag
    #[serde(default)]
    pub internal: bool,
    
    /// External mode configuration (when internal = false)
    pub base_url: Option<String>,
    pub account_id: Option<String>,
    pub default_org_id: Option<String>,
    pub default_project_id: Option<String>,
    pub api_key: Option<String>,
    
    /// Internal mode configuration (when internal = true)
    pub bearer_token: Option<String>,
    pub mcp_svc_secret: Option<String>,
    
    /// Service configurations for internal mode
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
    pub scs_svc_base_url: Option<String>,
    pub scs_svc_secret: Option<String>,
    pub sto_svc_base_url: Option<String>,
    pub sto_svc_secret: Option<String>,
    pub sei_svc_base_url: Option<String>,
    pub sei_svc_secret: Option<String>,
    pub audit_svc_base_url: Option<String>,
    pub audit_svc_secret: Option<String>,
    pub dbops_svc_base_url: Option<String>,
    pub dbops_svc_secret: Option<String>,
    pub rbac_svc_base_url: Option<String>,
    pub rbac_svc_secret: Option<String>,
}


/// Transport type enumeration matching Go implementation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TransportType {
    Stdio,
    Http,
    Internal,
}

impl Default for TransportType {
    fn default() -> Self {
        TransportType::Stdio
    }
}

/// HTTP server configuration matching Go implementation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpConfig {
    /// Server port (maps to MCP_HTTP_PORT env var)
    #[serde(default = "default_http_port")]
    pub port: u16,
    
    /// Server path (maps to MCP_HTTP_PATH env var)
    #[serde(default = "default_http_path")]
    pub path: String,
}

impl Default for HttpConfig {
    fn default() -> Self {
        Self {
            port: default_http_port(),
            path: default_http_path(),
        }
    }
}


impl Config {
    /// Load configuration from various sources
    pub fn load_from_sources() -> Result<Self> {
        let figment = Figment::new()
            .merge(Toml::file("harness-mcp.toml"))
            .merge(Yaml::file("harness-mcp.yaml"))
            .merge(Env::prefixed("HARNESS_"))
            .merge(Env::raw()); // Also support non-prefixed environment variables

        let config: Config = figment.extract()?;
        Ok(config)
    }

    /// Load configuration with custom environment prefix
    pub fn load_with_env_prefix(prefix: &str) -> Result<Self> {
        let figment = Figment::new()
            .merge(Toml::file("harness-mcp.toml"))
            .merge(Yaml::file("harness-mcp.yaml"))
            .merge(Env::prefixed(prefix))
            .merge(Env::raw());

        let config: Config = figment.extract()?;
        Ok(config)
    }

    /// Create configuration from environment variables only (for compatibility)
    pub fn from_env() -> Result<Self> {
        let figment = Figment::new()
            .merge(Env::prefixed("HARNESS_"))
            .merge(Env::raw());

        let config: Config = figment.extract()?;
        Ok(config)
    }

    /// Apply CLI overrides to the configuration
    pub fn apply_cli_overrides(
        &mut self,
        cli_debug: Option<bool>,
        cli_read_only: Option<bool>,
        cli_log_file: Option<String>,
        cli_toolsets: Option<Vec<String>>,
        cli_enable_license: Option<bool>,
        cli_enable_modules: Option<Vec<String>>,
        cli_output_dir: Option<String>,
        cli_http_port: Option<u16>,
        cli_http_path: Option<String>,
        cli_api_key: Option<String>,
        cli_base_url: Option<String>,
        cli_account_id: Option<String>,
    ) {
        if let Some(debug) = cli_debug {
            self.debug = debug;
        }
        
        if let Some(log_file) = cli_log_file {
            self.log_file_path = Some(log_file);
        }
        
        if let Some(read_only) = cli_read_only {
            self.read_only = read_only;
        }
        
        if let Some(toolsets) = cli_toolsets {
            self.toolsets = toolsets;
        }
        
        if let Some(enable_license) = cli_enable_license {
            self.enable_license = enable_license;
        }
        
        if let Some(modules) = cli_enable_modules {
            self.enable_modules = modules;
        }
        
        if let Some(output_dir) = cli_output_dir {
            self.output_dir = Some(output_dir);
        }
        
        if let Some(port) = cli_http_port {
            self.http.port = port;
        }
        
        if let Some(path) = cli_http_path {
            self.http.path = path;
        }
        
        if let Some(api_key) = cli_api_key {
            self.api_key = Some(api_key);
        }
        
        if let Some(base_url) = cli_base_url {
            self.base_url = Some(base_url);
        }
        
        if let Some(account_id) = cli_account_id {
            self.account_id = Some(account_id);
        }
    }

    /// Extract account ID from API key (matching Go implementation)
    pub fn extract_account_id_from_api_key(api_key: &str) -> Option<String> {
        // PAT format: pat.{account_id}.{token_id}.{token_value}
        let parts: Vec<&str> = api_key.split('.').collect();
        if parts.len() >= 2 && parts[0] == "pat" {
            Some(parts[1].to_string())
        } else {
            None
        }
    }

    /// Get effective account ID (from explicit setting or extracted from API key)
    pub fn get_account_id(&self) -> Option<String> {
        if let Some(account_id) = &self.account_id {
            Some(account_id.clone())
        } else if let Some(api_key) = &self.api_key {
            Self::extract_account_id_from_api_key(api_key)
        } else {
            None
        }
    }

    /// Check if running in internal mode
    pub fn is_internal_mode(&self) -> bool {
        self.internal
    }

    /// Check if running in external mode
    pub fn is_external_mode(&self) -> bool {
        !self.internal
    }
}

// Default value functions
fn default_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

fn default_http_port() -> u16 {
    8080
}

fn default_http_path() -> String {
    "/mcp".to_string()
}

fn default_toolsets() -> Vec<String> {
    vec!["default".to_string()]
}

// Note: CLI is defined in the main server crate
// We'll need to pass CLI data through parameters