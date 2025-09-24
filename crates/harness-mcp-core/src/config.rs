//! Configuration types and utilities

use serde::{Deserialize, Serialize};

/// Main configuration structure for Harness MCP Server
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    /// Application version
    pub version: String,

    /// Read-only mode flag
    pub read_only: bool,

    /// List of enabled toolsets
    pub toolsets: Vec<String>,

    /// List of enabled modules
    pub enable_modules: Vec<String>,

    /// Log file path
    pub log_file_path: Option<String>,

    /// Debug mode flag
    pub debug: bool,

    /// License validation enabled
    pub enable_license: bool,

    /// Output directory for files
    pub output_dir: Option<String>,

    /// Internal mode flag
    pub internal: bool,

    // External mode configuration
    /// Base URL for Harness
    pub base_url: Option<String>,

    /// Account ID
    pub account_id: Option<String>,

    /// Default organization ID
    pub default_org_id: Option<String>,

    /// Default project ID
    pub default_project_id: Option<String>,

    /// API key for authentication
    pub api_key: Option<String>,

    // HTTP server configuration
    /// HTTP server port
    pub http_port: u16,

    /// HTTP server path
    pub http_path: String,

    // Internal mode configuration
    /// Bearer token for internal authentication
    pub bearer_token: Option<String>,

    /// MCP service secret
    pub mcp_svc_secret: Option<String>,

    // Service URLs and secrets
    /// Pipeline service base URL
    pub pipeline_svc_base_url: Option<String>,

    /// Pipeline service secret
    pub pipeline_svc_secret: Option<String>,

    /// NG Manager base URL
    pub ng_manager_base_url: Option<String>,

    /// NG Manager secret
    pub ng_manager_secret: Option<String>,

    /// Chatbot service base URL
    pub chatbot_base_url: Option<String>,

    /// Chatbot service secret
    pub chatbot_secret: Option<String>,

    /// GenAI service base URL
    pub genai_base_url: Option<String>,

    /// GenAI service secret
    pub genai_secret: Option<String>,

    /// Artifact Registry service base URL
    pub artifact_registry_base_url: Option<String>,

    /// Artifact Registry service secret
    pub artifact_registry_secret: Option<String>,

    /// NextGen CE service base URL
    pub nextgen_ce_base_url: Option<String>,

    /// NextGen CE service secret
    pub nextgen_ce_secret: Option<String>,

    /// CCM Communication Orchestrator base URL
    pub ccm_comm_orch_base_url: Option<String>,

    /// CCM Communication Orchestrator secret
    pub ccm_comm_orch_secret: Option<String>,

    /// IDP service base URL
    pub idp_svc_base_url: Option<String>,

    /// IDP service secret
    pub idp_svc_secret: Option<String>,

    /// Chaos Manager service base URL
    pub chaos_manager_svc_base_url: Option<String>,

    /// Chaos Manager service secret
    pub chaos_manager_svc_secret: Option<String>,

    /// Template service base URL
    pub template_svc_base_url: Option<String>,

    /// Template service secret
    pub template_svc_secret: Option<String>,

    /// Intelligence service base URL
    pub intelligence_svc_base_url: Option<String>,

    /// Intelligence service secret
    pub intelligence_svc_secret: Option<String>,

    /// Code service base URL
    pub code_svc_base_url: Option<String>,

    /// Code service secret
    pub code_svc_secret: Option<String>,

    /// Log service base URL
    pub log_svc_base_url: Option<String>,

    /// Log service secret
    pub log_svc_secret: Option<String>,

    /// Dashboard service base URL
    pub dashboard_svc_base_url: Option<String>,

    /// Dashboard service secret
    pub dashboard_svc_secret: Option<String>,

    /// SCS service base URL
    pub scs_svc_base_url: Option<String>,

    /// SCS service secret
    pub scs_svc_secret: Option<String>,

    /// STO service base URL
    pub sto_svc_base_url: Option<String>,

    /// STO service secret
    pub sto_svc_secret: Option<String>,

    /// SEI service base URL
    pub sei_svc_base_url: Option<String>,

    /// SEI service secret
    pub sei_svc_secret: Option<String>,

    /// Audit service base URL
    pub audit_svc_base_url: Option<String>,

    /// Audit service secret
    pub audit_svc_secret: Option<String>,

    /// DBOps service base URL
    pub dbops_svc_base_url: Option<String>,

    /// DBOps service secret
    pub dbops_svc_secret: Option<String>,

    /// RBAC service base URL
    pub rbac_svc_base_url: Option<String>,

    /// RBAC service secret
    pub rbac_svc_secret: Option<String>,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            version: "0.1.0".to_string(),
            read_only: false,
            toolsets: vec!["default".to_string()],
            enable_modules: Vec::new(),
            log_file_path: None,
            debug: false,
            enable_license: false,
            output_dir: None,
            internal: false,
            base_url: Some("https://app.harness.io".to_string()),
            account_id: None,
            default_org_id: None,
            default_project_id: None,
            api_key: None,
            http_port: 8080,
            http_path: "/mcp".to_string(),
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
    /// Validate the configuration
    pub fn validate(&self) -> crate::Result<()> {
        if !self.internal {
            // External mode validation
            if self.api_key.is_none() {
                return Err(crate::Error::config(
                    "API key is required for external mode",
                ));
            }
        } else {
            // Internal mode validation
            if self.bearer_token.is_none() {
                return Err(crate::Error::config(
                    "Bearer token is required for internal mode",
                ));
            }
            if self.mcp_svc_secret.is_none() {
                return Err(crate::Error::config(
                    "MCP service secret is required for internal mode",
                ));
            }
        }

        Ok(())
    }

    /// Get the effective base URL
    pub fn get_base_url(&self) -> &str {
        self.base_url.as_deref().unwrap_or("https://app.harness.io")
    }

    /// Check if a toolset is enabled
    pub fn is_toolset_enabled(&self, toolset: &str) -> bool {
        self.toolsets.is_empty()
            || self.toolsets.contains(&"all".to_string())
            || self.toolsets.contains(&toolset.to_string())
    }

    /// Check if a module is enabled
    pub fn is_module_enabled(&self, module: &str) -> bool {
        self.enable_modules.is_empty()
            || self.enable_modules.contains(&"all".to_string())
            || self.enable_modules.contains(&module.to_string())
    }
}
