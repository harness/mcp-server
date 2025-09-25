//! Environment variable handling for Harness MCP Server
//!
//! This module provides utilities for loading configuration from environment variables
//! with the same naming conventions as the Go implementation.

use crate::config::{Config, HttpConfig, TransportType};
use crate::error::Result;
use std::env;

/// Environment variable names used by the Go implementation
pub struct EnvVars;

impl EnvVars {
    // Common configuration
    pub const READ_ONLY: &'static str = "HARNESS_READ_ONLY";
    pub const DEBUG: &'static str = "HARNESS_DEBUG";
    pub const LOG_FILE: &'static str = "HARNESS_LOG_FILE";
    pub const ENABLE_LICENSE: &'static str = "HARNESS_ENABLE_LICENSE";
    pub const OUTPUT_DIR: &'static str = "HARNESS_OUTPUT_DIR";
    pub const TOOLSETS: &'static str = "HARNESS_TOOLSETS";
    pub const ENABLE_MODULES: &'static str = "HARNESS_ENABLE_MODULES";
    
    // HTTP configuration
    pub const HTTP_PORT: &'static str = "MCP_HTTP_PORT";
    pub const HTTP_PATH: &'static str = "MCP_HTTP_PATH";
    
    // External mode configuration
    pub const API_KEY: &'static str = "HARNESS_API_KEY";
    pub const BASE_URL: &'static str = "HARNESS_BASE_URL";
    pub const ACCOUNT_ID: &'static str = "HARNESS_ACCOUNT_ID";
    pub const DEFAULT_ORG_ID: &'static str = "HARNESS_DEFAULT_ORG_ID";
    pub const DEFAULT_PROJECT_ID: &'static str = "HARNESS_DEFAULT_PROJECT_ID";
    
    // Internal mode configuration
    pub const BEARER_TOKEN: &'static str = "HARNESS_BEARER_TOKEN";
    pub const MCP_SVC_SECRET: &'static str = "HARNESS_MCP_SVC_SECRET";
    
    // Service configurations
    pub const PIPELINE_SVC_BASE_URL: &'static str = "HARNESS_PIPELINE_SVC_BASE_URL";
    pub const PIPELINE_SVC_SECRET: &'static str = "HARNESS_PIPELINE_SVC_SECRET";
    pub const NG_MANAGER_BASE_URL: &'static str = "HARNESS_NG_MANAGER_BASE_URL";
    pub const NG_MANAGER_SECRET: &'static str = "HARNESS_NG_MANAGER_SECRET";
    pub const CHATBOT_BASE_URL: &'static str = "HARNESS_CHATBOT_BASE_URL";
    pub const CHATBOT_SECRET: &'static str = "HARNESS_CHATBOT_SECRET";
    pub const GENAI_BASE_URL: &'static str = "HARNESS_GENAI_BASE_URL";
    pub const GENAI_SECRET: &'static str = "HARNESS_GENAI_SECRET";
    pub const ARTIFACT_REGISTRY_BASE_URL: &'static str = "HARNESS_ARTIFACT_REGISTRY_BASE_URL";
    pub const ARTIFACT_REGISTRY_SECRET: &'static str = "HARNESS_ARTIFACT_REGISTRY_SECRET";
    pub const NEXTGEN_CE_BASE_URL: &'static str = "HARNESS_NEXTGEN_CE_BASE_URL";
    pub const NEXTGEN_CE_SECRET: &'static str = "HARNESS_NEXTGEN_CE_SECRET";
    pub const CCM_COMM_ORCH_BASE_URL: &'static str = "HARNESS_CCM_COMM_ORCH_BASE_URL";
    pub const CCM_COMM_ORCH_SECRET: &'static str = "HARNESS_CCM_COMM_ORCH_SECRET";
    pub const IDP_SVC_BASE_URL: &'static str = "HARNESS_IDP_SVC_BASE_URL";
    pub const IDP_SVC_SECRET: &'static str = "HARNESS_IDP_SVC_SECRET";
    pub const CHAOS_MANAGER_SVC_BASE_URL: &'static str = "HARNESS_CHAOS_MANAGER_SVC_BASE_URL";
    pub const CHAOS_MANAGER_SVC_SECRET: &'static str = "HARNESS_CHAOS_MANAGER_SVC_SECRET";
    pub const TEMPLATE_SVC_BASE_URL: &'static str = "HARNESS_TEMPLATE_SVC_BASE_URL";
    pub const TEMPLATE_SVC_SECRET: &'static str = "HARNESS_TEMPLATE_SVC_SECRET";
    pub const INTELLIGENCE_SVC_BASE_URL: &'static str = "HARNESS_INTELLIGENCE_SVC_BASE_URL";
    pub const INTELLIGENCE_SVC_SECRET: &'static str = "HARNESS_INTELLIGENCE_SVC_SECRET";
    pub const CODE_SVC_BASE_URL: &'static str = "HARNESS_CODE_SVC_BASE_URL";
    pub const CODE_SVC_SECRET: &'static str = "HARNESS_CODE_SVC_SECRET";
    pub const LOG_SVC_BASE_URL: &'static str = "HARNESS_LOG_SVC_BASE_URL";
    pub const LOG_SVC_SECRET: &'static str = "HARNESS_LOG_SVC_SECRET";
    pub const DASHBOARD_SVC_BASE_URL: &'static str = "HARNESS_DASHBOARD_SVC_BASE_URL";
    pub const DASHBOARD_SVC_SECRET: &'static str = "HARNESS_DASHBOARD_SVC_SECRET";
    pub const SCS_SVC_BASE_URL: &'static str = "HARNESS_SCS_SVC_BASE_URL";
    pub const SCS_SVC_SECRET: &'static str = "HARNESS_SCS_SVC_SECRET";
    pub const STO_SVC_BASE_URL: &'static str = "HARNESS_STO_SVC_BASE_URL";
    pub const STO_SVC_SECRET: &'static str = "HARNESS_STO_SVC_SECRET";
    pub const SEI_SVC_BASE_URL: &'static str = "HARNESS_SEI_SVC_BASE_URL";
    pub const SEI_SVC_SECRET: &'static str = "HARNESS_SEI_SVC_SECRET";
    pub const AUDIT_SVC_BASE_URL: &'static str = "HARNESS_AUDIT_SVC_BASE_URL";
    pub const AUDIT_SVC_SECRET: &'static str = "HARNESS_AUDIT_SVC_SECRET";
    pub const DBOPS_SVC_BASE_URL: &'static str = "HARNESS_DBOPS_SVC_BASE_URL";
    pub const DBOPS_SVC_SECRET: &'static str = "HARNESS_DBOPS_SVC_SECRET";
    pub const RBAC_SVC_BASE_URL: &'static str = "HARNESS_RBAC_SVC_BASE_URL";
    pub const RBAC_SVC_SECRET: &'static str = "HARNESS_RBAC_SVC_SECRET";
}

/// Load configuration from environment variables using Go-compatible naming
pub fn load_config_from_env() -> Result<Config> {
    let mut config = Config::default();
    
    // Load common configuration
    if let Ok(value) = env::var(EnvVars::READ_only) {
        config.read_only = value.parse().unwrap_or(false);
    }
    
    if let Ok(value) = env::var(EnvVars::DEBUG) {
        config.debug = value.parse().unwrap_or(false);
    }
    
    if let Ok(value) = env::var(EnvVars::LOG_FILE) {
        config.log_file_path = Some(value);
    }
    
    if let Ok(value) = env::var(EnvVars::ENABLE_LICENSE) {
        config.enable_license = value.parse().unwrap_or(false);
    }
    
    if let Ok(value) = env::var(EnvVars::OUTPUT_DIR) {
        config.output_dir = Some(value);
    }
    
    if let Ok(value) = env::var(EnvVars::TOOLSETS) {
        config.toolsets = value.split(',').map(|s| s.trim().to_string()).collect();
    }
    
    if let Ok(value) = env::var(EnvVars::ENABLE_MODULES) {
        config.enable_modules = value.split(',').map(|s| s.trim().to_string()).collect();
    }
    
    // Load HTTP configuration
    if let Ok(value) = env::var(EnvVars::HTTP_PORT) {
        if let Ok(port) = value.parse::<u16>() {
            config.http.port = port;
        }
    }
    
    if let Ok(value) = env::var(EnvVars::HTTP_PATH) {
        config.http.path = value;
    }
    
    // Load external mode configuration
    config.api_key = env::var(EnvVars::API_KEY).ok();
    config.base_url = env::var(EnvVars::BASE_URL).ok();
    config.account_id = env::var(EnvVars::ACCOUNT_ID).ok();
    config.default_org_id = env::var(EnvVars::DEFAULT_ORG_ID).ok();
    config.default_project_id = env::var(EnvVars::DEFAULT_PROJECT_ID).ok();
    
    // Load internal mode configuration
    config.bearer_token = env::var(EnvVars::BEARER_TOKEN).ok();
    config.mcp_svc_secret = env::var(EnvVars::MCP_SVC_SECRET).ok();
    
    // Load service configurations
    config.pipeline_svc_base_url = env::var(EnvVars::PIPELINE_SVC_BASE_URL).ok();
    config.pipeline_svc_secret = env::var(EnvVars::PIPELINE_SVC_SECRET).ok();
    config.ng_manager_base_url = env::var(EnvVars::NG_MANAGER_BASE_URL).ok();
    config.ng_manager_secret = env::var(EnvVars::NG_MANAGER_SECRET).ok();
    config.chatbot_base_url = env::var(EnvVars::CHATBOT_BASE_URL).ok();
    config.chatbot_secret = env::var(EnvVars::CHATBOT_SECRET).ok();
    config.genai_base_url = env::var(EnvVars::GENAI_BASE_URL).ok();
    config.genai_secret = env::var(EnvVars::GENAI_SECRET).ok();
    config.artifact_registry_base_url = env::var(EnvVars::ARTIFACT_REGISTRY_BASE_URL).ok();
    config.artifact_registry_secret = env::var(EnvVars::ARTIFACT_REGISTRY_SECRET).ok();
    config.nextgen_ce_base_url = env::var(EnvVars::NEXTGEN_CE_BASE_URL).ok();
    config.nextgen_ce_secret = env::var(EnvVars::NEXTGEN_CE_SECRET).ok();
    config.ccm_comm_orch_base_url = env::var(EnvVars::CCM_COMM_ORCH_BASE_URL).ok();
    config.ccm_comm_orch_secret = env::var(EnvVars::CCM_COMM_ORCH_SECRET).ok();
    config.idp_svc_base_url = env::var(EnvVars::IDP_SVC_BASE_URL).ok();
    config.idp_svc_secret = env::var(EnvVars::IDP_SVC_SECRET).ok();
    config.chaos_manager_svc_base_url = env::var(EnvVars::CHAOS_MANAGER_SVC_BASE_URL).ok();
    config.chaos_manager_svc_secret = env::var(EnvVars::CHAOS_MANAGER_SVC_SECRET).ok();
    config.template_svc_base_url = env::var(EnvVars::TEMPLATE_SVC_BASE_URL).ok();
    config.template_svc_secret = env::var(EnvVars::TEMPLATE_SVC_SECRET).ok();
    config.intelligence_svc_base_url = env::var(EnvVars::INTELLIGENCE_SVC_BASE_URL).ok();
    config.intelligence_svc_secret = env::var(EnvVars::INTELLIGENCE_SVC_SECRET).ok();
    config.code_svc_base_url = env::var(EnvVars::CODE_SVC_BASE_URL).ok();
    config.code_svc_secret = env::var(EnvVars::CODE_SVC_SECRET).ok();
    config.log_svc_base_url = env::var(EnvVars::LOG_SVC_BASE_URL).ok();
    config.log_svc_secret = env::var(EnvVars::LOG_SVC_SECRET).ok();
    config.dashboard_svc_base_url = env::var(EnvVars::DASHBOARD_SVC_BASE_URL).ok();
    config.dashboard_svc_secret = env::var(EnvVars::DASHBOARD_SVC_SECRET).ok();
    config.scs_svc_base_url = env::var(EnvVars::SCS_SVC_BASE_URL).ok();
    config.scs_svc_secret = env::var(EnvVars::SCS_SVC_SECRET).ok();
    config.sto_svc_base_url = env::var(EnvVars::STO_SVC_BASE_URL).ok();
    config.sto_svc_secret = env::var(EnvVars::STO_SVC_SECRET).ok();
    config.sei_svc_base_url = env::var(EnvVars::SEI_SVC_BASE_URL).ok();
    config.sei_svc_secret = env::var(EnvVars::SEI_SVC_SECRET).ok();
    config.audit_svc_base_url = env::var(EnvVars::AUDIT_SVC_BASE_URL).ok();
    config.audit_svc_secret = env::var(EnvVars::AUDIT_SVC_SECRET).ok();
    config.dbops_svc_base_url = env::var(EnvVars::DBOPS_SVC_BASE_URL).ok();
    config.dbops_svc_secret = env::var(EnvVars::DBOPS_SVC_SECRET).ok();
    config.rbac_svc_base_url = env::var(EnvVars::RBAC_SVC_BASE_URL).ok();
    config.rbac_svc_secret = env::var(EnvVars::RBAC_SVC_SECRET).ok();
    
    // Determine if running in internal mode based on presence of internal-specific config
    config.internal = config.bearer_token.is_some() || config.mcp_svc_secret.is_some();
    
    Ok(config)
}

impl Default for Config {
    fn default() -> Self {
        Self {
            version: env!("CARGO_PKG_VERSION").to_string(),
            read_only: false,
            toolsets: vec!["default".to_string()],
            enable_modules: Vec::new(),
            log_file_path: None,
            debug: false,
            enable_license: false,
            output_dir: None,
            transport: TransportType::Stdio,
            http: HttpConfig::default(),
            internal: false,
            base_url: None,
            account_id: None,
            default_org_id: None,
            default_project_id: None,
            api_key: None,
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[test]
    fn test_env_var_constants() {
        assert_eq!(EnvVars::API_KEY, "HARNESS_API_KEY");
        assert_eq!(EnvVars::HTTP_PORT, "MCP_HTTP_PORT");
        assert_eq!(EnvVars::READ_ONLY, "HARNESS_READ_ONLY");
    }

    #[test]
    fn test_load_config_from_env() {
        // Set some test environment variables
        env::set_var(EnvVars::READ_ONLY, "true");
        env::set_var(EnvVars::HTTP_PORT, "9090");
        env::set_var(EnvVars::API_KEY, "pat.test_account.test_token.test_value");
        
        let config = load_config_from_env().unwrap();
        
        assert!(config.read_only);
        assert_eq!(config.http.port, 9090);
        assert_eq!(config.api_key, Some("pat.test_account.test_token.test_value".to_string()));
        
        // Clean up
        env::remove_var(EnvVars::READ_ONLY);
        env::remove_var(EnvVars::HTTP_PORT);
        env::remove_var(EnvVars::API_KEY);
    }

    #[test]
    fn test_config_default() {
        let config = Config::default();
        assert!(!config.read_only);
        assert_eq!(config.http.port, 8080);
        assert_eq!(config.http.path, "/mcp");
        assert_eq!(config.toolsets, vec!["default".to_string()]);
    }
}