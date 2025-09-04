//! Configuration types for the Harness MCP server

use serde::{Deserialize, Serialize};
use super::TransportType;

/// Main configuration structure for the Harness MCP server
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    /// Application version
    pub version: String,
    
    /// Base URL for Harness API
    pub base_url: Option<String>,
    
    /// Account ID
    pub account_id: Option<String>,
    
    /// Default organization ID
    pub default_org_id: Option<String>,
    
    /// Default project ID
    pub default_project_id: Option<String>,
    
    /// API key for authentication
    pub api_key: Option<String>,
    
    /// Whether to restrict to read-only operations
    pub read_only: bool,
    
    /// List of enabled toolsets
    pub toolsets: Vec<String>,
    
    /// Log file path
    pub log_file_path: Option<String>,
    
    /// Debug mode
    pub debug: bool,
    
    /// List of enabled modules
    pub enable_modules: Vec<String>,
    
    /// Whether to enable license validation
    pub enable_license: bool,
    
    /// Transport configuration
    pub transport: TransportType,
    
    /// HTTP configuration
    pub http: HttpConfig,
    
    /// Internal mode flag
    pub internal: bool,
    
    /// Bearer token for internal mode
    pub bearer_token: Option<String>,
    
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
    pub scs_svc_secret: Option<String>,
    pub scs_svc_base_url: Option<String>,
    pub sto_svc_secret: Option<String>,
    pub sto_svc_base_url: Option<String>,
    pub audit_svc_base_url: Option<String>,
    pub audit_svc_secret: Option<String>,
    pub dbops_svc_base_url: Option<String>,
    pub dbops_svc_secret: Option<String>,
    pub rbac_svc_base_url: Option<String>,
    pub rbac_svc_secret: Option<String>,
}

/// HTTP server configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpConfig {
    /// HTTP server port
    pub port: u16,
    
    /// HTTP server path
    pub path: String,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            version: crate::VERSION.to_string(),
            base_url: Some("https://app.harness.io".to_string()),
            account_id: None,
            default_org_id: None,
            default_project_id: None,
            api_key: None,
            read_only: false,
            toolsets: vec![],
            log_file_path: None,
            debug: false,
            enable_modules: vec![],
            enable_license: false,
            transport: TransportType::Stdio,
            http: HttpConfig {
                port: 8080,
                path: "/mcp".to_string(),
            },
            internal: false,
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
            scs_svc_secret: None,
            scs_svc_base_url: None,
            sto_svc_secret: None,
            sto_svc_base_url: None,
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
    pub fn extract_account_id_from_api_key(&self) -> crate::Result<String> {
        let api_key = self.api_key.as_ref()
            .ok_or_else(|| crate::HarnessError::config("API key not provided"))?;
            
        let parts: Vec<&str> = api_key.split('.').collect();
        if parts.len() < 2 {
            return Err(crate::HarnessError::InvalidApiKey);
        }
        
        Ok(parts[1].to_string())
    }
}