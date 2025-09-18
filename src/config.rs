use std::path::PathBuf;
use crate::types::TransportType;

/// Configuration for the Harness MCP Server
#[derive(Debug, Clone)]
pub struct Config {
    // Common fields for both modes
    pub version: String,
    pub transport: TransportType,
    pub http_port: u16,
    pub http_path: String,
    pub read_only: bool,
    pub toolsets: Vec<String>,
    pub enable_modules: Vec<String>,
    pub enable_license: bool,
    pub output_dir: Option<PathBuf>,
    pub internal: bool,

    // External mode fields (stdio with API key)
    pub base_url: Option<String>,
    pub account_id: Option<String>,
    pub default_org_id: Option<String>,
    pub default_project_id: Option<String>,
    pub api_key: Option<String>,

    // Internal mode fields (with bearer token and service secrets)
    pub bearer_token: Option<String>,
    pub pipeline_svc_base_url: Option<String>,
    pub pipeline_svc_secret: Option<String>,
    pub mcp_svc_secret: Option<String>,
    pub ng_manager_base_url: Option<String>,
    pub ng_manager_secret: Option<String>,
}

impl Config {
    /// Check if the configuration is for external mode
    pub fn is_external(&self) -> bool {
        !self.internal
    }

    /// Check if the configuration is for internal mode
    pub fn is_internal(&self) -> bool {
        self.internal
    }

    /// Get the base URL for API calls
    pub fn get_base_url(&self) -> Option<&str> {
        self.base_url.as_deref()
    }

    /// Get the account ID
    pub fn get_account_id(&self) -> Option<&str> {
        self.account_id.as_deref()
    }

    /// Get the API key for external authentication
    pub fn get_api_key(&self) -> Option<&str> {
        self.api_key.as_deref()
    }

    /// Get the bearer token for internal authentication
    pub fn get_bearer_token(&self) -> Option<&str> {
        self.bearer_token.as_deref()
    }

    /// Check if a specific toolset is enabled
    pub fn is_toolset_enabled(&self, toolset: &str) -> bool {
        self.toolsets.contains(&"all".to_string()) || self.toolsets.contains(&toolset.to_string())
    }

    /// Check if a specific module is enabled
    pub fn is_module_enabled(&self, module: &str) -> bool {
        self.enable_modules.contains(&"all".to_string()) || self.enable_modules.contains(&module.to_string())
    }
}

impl Default for Config {
    fn default() -> Self {
        Self {
            version: env!("CARGO_PKG_VERSION").to_string(),
            transport: TransportType::Stdio,
            http_port: 8080,
            http_path: "/mcp".to_string(),
            read_only: false,
            toolsets: vec!["default".to_string()],
            enable_modules: vec![],
            enable_license: false,
            output_dir: None,
            internal: false,
            base_url: Some("https://app.harness.io".to_string()),
            account_id: None,
            default_org_id: None,
            default_project_id: None,
            api_key: None,
            bearer_token: None,
            pipeline_svc_base_url: None,
            pipeline_svc_secret: None,
            mcp_svc_secret: None,
            ng_manager_base_url: None,
            ng_manager_secret: None,
        }
    }
}