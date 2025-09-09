pub mod error;

pub use error::{ConfigError, Result};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    // Common fields
    pub debug: bool,
    pub read_only: bool,
    pub enable_license: bool,
    pub toolsets: Vec<String>,
    pub enable_modules: Vec<String>,
    pub log_file: Option<String>,

    // External mode fields
    pub base_url: String,
    pub api_key: Option<String>,
    pub default_org_id: Option<String>,
    pub default_project_id: Option<String>,

    // HTTP server configuration
    pub http_port: u16,
    pub http_path: String,

    // Internal mode fields
    pub internal: bool,
    pub bearer_token: Option<String>,
    pub mcp_svc_secret: Option<String>,

    // Service URLs for internal mode
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

impl Default for Config {
    fn default() -> Self {
        Self {
            debug: false,
            read_only: false,
            enable_license: false,
            toolsets: vec![],
            enable_modules: vec![],
            log_file: None,
            base_url: "https://app.harness.io".to_string(),
            api_key: None,
            default_org_id: None,
            default_project_id: None,
            http_port: 8080,
            http_path: "/mcp".to_string(),
            internal: false,
            bearer_token: None,
            mcp_svc_secret: None,
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
            scs_svc_base_url: None,
            scs_svc_secret: None,
            sto_svc_base_url: None,
            sto_svc_secret: None,
            sei_svc_base_url: None,
            sei_svc_secret: None,
            audit_svc_base_url: None,
            audit_svc_secret: None,
            dbops_svc_base_url: None,
            dbops_svc_secret: None,
            rbac_svc_base_url: None,
            rbac_svc_secret: None,
        }
    }
}

impl Config {
    /// Extract account ID from API key
    /// API key format: pat.ACCOUNT_ID.TOKEN_ID.<>
    pub fn extract_account_id(&self) -> Option<String> {
        self.api_key.as_ref().and_then(|key| {
            let parts: Vec<&str> = key.split('.').collect();
            if parts.len() >= 2 {
                Some(parts[1].to_string())
            } else {
                None
            }
        })
    }

    /// Check if running in internal mode
    pub fn is_internal(&self) -> bool {
        self.internal
    }

    /// Get effective base URL for API calls
    pub fn get_base_url(&self) -> &str {
        &self.base_url
    }

    /// Validate configuration
    pub fn validate(&self) -> Result<()> {
        if !self.internal && self.api_key.is_none() {
            return Err(ConfigError::MissingRequired("api_key".to_string()));
        }

        if self.internal && self.bearer_token.is_none() {
            return Err(ConfigError::MissingRequired("bearer_token".to_string()));
        }

        if self.base_url.is_empty() {
            return Err(ConfigError::MissingRequired("base_url".to_string()));
        }

        if !self.base_url.starts_with("http://") && !self.base_url.starts_with("https://") {
            return Err(ConfigError::InvalidValue {
                field: "base_url".to_string(),
                value: self.base_url.clone(),
            });
        }

        if self.http_port == 0 {
            return Err(ConfigError::InvalidValue {
                field: "http_port".to_string(),
                value: self.http_port.to_string(),
            });
        }

        Ok(())
    }

    /// Load configuration from environment variables
    pub fn from_env() -> Result<Self> {
        let mut config = Self::default();

        if let Ok(debug) = std::env::var("DEBUG") {
            config.debug = debug.parse().unwrap_or(false);
        }

        if let Ok(api_key) = std::env::var("HARNESS_API_KEY") {
            config.api_key = Some(api_key);
        }

        if let Ok(base_url) = std::env::var("HARNESS_BASE_URL") {
            config.base_url = base_url;
        }

        if let Ok(org_id) = std::env::var("HARNESS_DEFAULT_ORG_ID") {
            config.default_org_id = Some(org_id);
        }

        if let Ok(project_id) = std::env::var("HARNESS_DEFAULT_PROJECT_ID") {
            config.default_project_id = Some(project_id);
        }

        if let Ok(port) = std::env::var("HTTP_PORT") {
            config.http_port = port.parse().map_err(|_| ConfigError::InvalidValue {
                field: "http_port".to_string(),
                value: port,
            })?;
        }

        if let Ok(bearer_token) = std::env::var("BEARER_TOKEN") {
            config.bearer_token = Some(bearer_token);
            config.internal = true;
        }

        config.validate()?;
        Ok(config)
    }

    /// Load configuration from a file (YAML or JSON)
    pub fn from_file<P: AsRef<std::path::Path>>(path: P) -> Result<Self> {
        let path = path.as_ref();
        let content = std::fs::read_to_string(path).map_err(|e| match e.kind() {
            std::io::ErrorKind::NotFound => ConfigError::FileNotFound(path.display().to_string()),
            std::io::ErrorKind::PermissionDenied => {
                ConfigError::PermissionDenied(path.display().to_string())
            }
            _ => ConfigError::Io(e),
        })?;

        let config = if path.extension().and_then(|s| s.to_str()) == Some("yaml")
            || path.extension().and_then(|s| s.to_str()) == Some("yml")
        {
            serde_yaml::from_str(&content)?
        } else if path.extension().and_then(|s| s.to_str()) == Some("json") {
            serde_json::from_str(&content)?
        } else {
            return Err(ConfigError::UnsupportedFormat(
                path.extension()
                    .and_then(|s| s.to_str())
                    .unwrap_or("unknown")
                    .to_string(),
            ));
        };

        Ok(config)
    }

    /// Load configuration with precedence: file -> env -> defaults
    pub fn load() -> Result<Self> {
        // Try to load from config file first
        let config_paths = [
            "harness-mcp.yaml",
            "harness-mcp.yml",
            "harness-mcp.json",
            "config/harness-mcp.yaml",
            "config/harness-mcp.yml",
            "config/harness-mcp.json",
        ];

        for path in &config_paths {
            if std::path::Path::new(path).exists() {
                match Self::from_file(path) {
                    Ok(mut config) => {
                        // Override with environment variables
                        config.apply_env_overrides()?;
                        config.validate()?;
                        return Ok(config);
                    }
                    Err(e) => {
                        eprintln!("Warning: Failed to load config from {}: {}", path, e);
                    }
                }
            }
        }

        // Fall back to environment-only configuration
        Self::from_env()
    }

    /// Apply environment variable overrides to existing config
    pub fn apply_env_overrides(&mut self) -> Result<()> {
        if let Ok(debug) = std::env::var("DEBUG") {
            self.debug = debug.parse().unwrap_or(false);
        }

        if let Ok(api_key) = std::env::var("HARNESS_API_KEY") {
            self.api_key = Some(api_key);
        }

        if let Ok(base_url) = std::env::var("HARNESS_BASE_URL") {
            self.base_url = base_url;
        }

        if let Ok(org_id) = std::env::var("HARNESS_DEFAULT_ORG_ID") {
            self.default_org_id = Some(org_id);
        }

        if let Ok(project_id) = std::env::var("HARNESS_DEFAULT_PROJECT_ID") {
            self.default_project_id = Some(project_id);
        }

        if let Ok(port) = std::env::var("HTTP_PORT") {
            self.http_port = port.parse().map_err(|_| ConfigError::InvalidValue {
                field: "http_port".to_string(),
                value: port,
            })?;
        }

        if let Ok(bearer_token) = std::env::var("BEARER_TOKEN") {
            self.bearer_token = Some(bearer_token);
            self.internal = true;
        }

        if let Ok(toolsets) = std::env::var("HARNESS_TOOLSETS") {
            self.toolsets = toolsets.split(',').map(|s| s.trim().to_string()).collect();
        }

        if let Ok(modules) = std::env::var("HARNESS_ENABLE_MODULES") {
            self.enable_modules = modules.split(',').map(|s| s.trim().to_string()).collect();
        }

        Ok(())
    }
}
