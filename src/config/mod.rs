//! Configuration management for the Harness MCP Server

use serde::{Deserialize, Serialize};

/// Main configuration structure for the Harness MCP Server
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    /// Server version
    pub version: String,

    /// Base URL for Harness API
    pub base_url: String,

    /// Account ID extracted from API key or session
    pub account_id: String,

    /// Default organization ID
    pub default_org_id: Option<String>,

    /// Default project ID
    pub default_project_id: Option<String>,

    /// API key for external authentication
    pub api_key: Option<String>,

    /// Bearer token for internal authentication
    pub bearer_token: Option<String>,

    /// Whether to run in read-only mode
    pub read_only: bool,

    /// List of enabled toolsets
    pub toolsets: Vec<String>,

    /// Whether license validation is enabled
    pub enable_license: bool,

    /// List of enabled modules
    pub enable_modules: Vec<String>,

    /// Whether running in internal mode
    pub internal: bool,

    // Internal service configurations
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
    
    /// Artifact Registry base URL
    pub artifact_registry_base_url: Option<String>,
    /// Artifact Registry secret
    pub artifact_registry_secret: Option<String>,
    
    /// NextGen CE base URL
    pub nextgen_ce_base_url: Option<String>,
    /// NextGen CE secret
    pub nextgen_ce_secret: Option<String>,
    
    /// CCM Communication Orchestrator base URL
    pub ccm_comm_orch_base_url: Option<String>,
    /// CCM Communication Orchestrator secret
    pub ccm_comm_orch_secret: Option<String>,
    
    /// IDP service base URL
    pub idp_svc_base_url: Option<String>,
    /// IDP service secret
    pub idp_svc_secret: Option<String>,
    
    /// MCP service secret
    pub mcp_svc_secret: Option<String>,
    
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
    
    /// SCS service base URL
    pub scs_svc_base_url: Option<String>,
    /// SCS service secret
    pub scs_svc_secret: Option<String>,
    
    /// STO service base URL
    pub sto_svc_base_url: Option<String>,
    /// STO service secret
    pub sto_svc_secret: Option<String>,
    
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
            version: env!("CARGO_PKG_VERSION").to_string(),
            base_url: "https://app.harness.io".to_string(),
            account_id: String::new(),
            default_org_id: None,
            default_project_id: None,
            api_key: None,
            bearer_token: None,
            read_only: false,
            toolsets: vec![],
            enable_license: false,
            enable_modules: vec![],
            internal: false,
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
        }
    }
}