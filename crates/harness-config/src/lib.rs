use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use url::Url;

/// Main configuration structure for the Harness MCP Server
/// Migrated from Go config.Config struct
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    /// Server version
    pub version: String,
    
    /// Base URL for Harness platform
    pub base_url: String,
    
    /// Account ID
    pub account_id: String,
    
    /// Default organization ID
    pub default_org_id: Option<String>,
    
    /// Default project ID
    pub default_project_id: Option<String>,
    
    /// API key for external authentication
    pub api_key: Option<String>,
    
    /// Bearer token for internal authentication
    pub bearer_token: Option<String>,
    
    /// Whether server is running in read-only mode
    pub read_only: bool,
    
    /// List of enabled toolsets
    pub toolsets: Vec<String>,
    
    /// Path to log file
    pub log_file_path: Option<String>,
    
    /// Debug mode flag
    pub debug: bool,
    
    /// List of enabled modules
    pub enable_modules: Vec<String>,
    
    /// Whether license validation is enabled
    pub enable_license: bool,
    
    /// Whether running in internal mode
    pub internal: bool,
    
    // Service-specific configurations
    /// MCP service secret
    pub mcp_svc_secret: Option<String>,
    
    /// Pipeline service configuration
    pub pipeline_svc_base_url: Option<String>,
    pub pipeline_svc_secret: Option<String>,
    
    /// NG Manager service configuration
    pub ng_manager_base_url: Option<String>,
    pub ng_manager_secret: Option<String>,
    
    /// Chatbot service configuration
    pub chatbot_base_url: Option<String>,
    pub chatbot_secret: Option<String>,
    
    /// GenAI service configuration
    pub genai_base_url: Option<String>,
    pub genai_secret: Option<String>,
    
    /// Artifact Registry service configuration
    pub artifact_registry_base_url: Option<String>,
    pub artifact_registry_secret: Option<String>,
    
    /// NextGen CE service configuration
    pub nextgen_ce_base_url: Option<String>,
    pub nextgen_ce_secret: Option<String>,
    
    /// CCM Commitment Orchestration service configuration
    pub ccm_comm_orch_base_url: Option<String>,
    pub ccm_comm_orch_secret: Option<String>,
    
    /// IDP service configuration
    pub idp_svc_base_url: Option<String>,
    pub idp_svc_secret: Option<String>,
    
    /// Chaos Manager service configuration
    pub chaos_manager_svc_base_url: Option<String>,
    pub chaos_manager_svc_secret: Option<String>,
    
    /// Template service configuration
    pub template_svc_base_url: Option<String>,
    pub template_svc_secret: Option<String>,
    
    /// Intelligence service configuration
    pub intelligence_svc_base_url: Option<String>,
    pub intelligence_svc_secret: Option<String>,
    
    /// Code service configuration
    pub code_svc_base_url: Option<String>,
    pub code_svc_secret: Option<String>,
    
    /// Log service configuration
    pub log_svc_base_url: Option<String>,
    pub log_svc_secret: Option<String>,
    
    /// SCS service configuration
    pub scs_svc_base_url: Option<String>,
    pub scs_svc_secret: Option<String>,
    
    /// STO service configuration
    pub sto_svc_base_url: Option<String>,
    pub sto_svc_secret: Option<String>,
    
    /// Audit service configuration
    pub audit_svc_base_url: Option<String>,
    pub audit_svc_secret: Option<String>,
    
    /// DBOps service configuration
    pub dbops_svc_base_url: Option<String>,
    pub dbops_svc_secret: Option<String>,
    
    /// RBAC service configuration
    pub rbac_svc_base_url: Option<String>,
    pub rbac_svc_secret: Option<String>,
    
    /// Dashboard service configuration
    pub dashboard_svc_base_url: Option<String>,
    pub dashboard_svc_secret: Option<String>,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            version: env!("CARGO_PKG_VERSION").to_string(),
            base_url: "https://app.harness.io".to_string(),
            account_id: String::new(),
            default_org_id: None,
            default_project_id: None,
            api_key: None,
            bearer_token: None,
            read_only: false,
            toolsets: vec!["default".to_string()],
            log_file_path: None,
            debug: false,
            enable_modules: Vec::new(),
            enable_license: false,
            internal: false,
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
            scs_svc_base_url: None,
            scs_svc_secret: None,
            sto_svc_base_url: None,
            sto_svc_secret: None,
            audit_svc_base_url: None,
            audit_svc_secret: None,
            dbops_svc_base_url: None,
            dbops_svc_secret: None,
            rbac_svc_base_url: None,
            rbac_svc_secret: None,
            dashboard_svc_base_url: None,
            dashboard_svc_secret: None,
        }
    }
}

impl Config {
    /// Validate the configuration
    pub fn validate(&self) -> Result<(), ConfigError> {
        // Validate base URL
        Url::parse(&self.base_url)
            .map_err(|_| ConfigError::InvalidBaseUrl(self.base_url.clone()))?;
        
        // Validate authentication
        if !self.internal && self.api_key.is_none() {
            return Err(ConfigError::MissingApiKey);
        }
        
        if self.internal {
            if self.bearer_token.is_none() {
                return Err(ConfigError::MissingBearerToken);
            }
            if self.mcp_svc_secret.is_none() {
                return Err(ConfigError::MissingMcpSecret);
            }
        }
        
        // Validate account ID
        if self.account_id.is_empty() {
            return Err(ConfigError::MissingAccountId);
        }
        
        Ok(())
    }
    
    /// Get service configuration for a specific service
    pub fn get_service_config(&self, service_name: &str) -> Option<ServiceConfig> {
        match service_name {
            "pipeline" => Some(ServiceConfig {
                base_url: self.pipeline_svc_base_url.clone(),
                secret: self.pipeline_svc_secret.clone(),
            }),
            "ng-manager" => Some(ServiceConfig {
                base_url: self.ng_manager_base_url.clone(),
                secret: self.ng_manager_secret.clone(),
            }),
            "chatbot" => Some(ServiceConfig {
                base_url: self.chatbot_base_url.clone(),
                secret: self.chatbot_secret.clone(),
            }),
            "genai" => Some(ServiceConfig {
                base_url: self.genai_base_url.clone(),
                secret: self.genai_secret.clone(),
            }),
            // Add more services as needed
            _ => None,
        }
    }
}

/// Service-specific configuration
#[derive(Debug, Clone)]
pub struct ServiceConfig {
    pub base_url: Option<String>,
    pub secret: Option<String>,
}

/// Configuration errors
#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("Invalid base URL: {0}")]
    InvalidBaseUrl(String),
    
    #[error("API key is required for external mode")]
    MissingApiKey,
    
    #[error("Bearer token is required for internal mode")]
    MissingBearerToken,
    
    #[error("MCP service secret is required for internal mode")]
    MissingMcpSecret,
    
    #[error("Account ID is required")]
    MissingAccountId,
}