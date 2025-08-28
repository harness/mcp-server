use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    // Common fields for both modes
    pub version: String,
    pub read_only: bool,
    pub toolsets: Vec<String>,
    pub enable_modules: Vec<String>,
    pub debug: bool,
    pub enable_license: bool,
    pub internal: bool,

    // External mode fields
    pub base_url: Option<String>,
    pub account_id: Option<String>,
    pub default_org_id: Option<String>,
    pub default_project_id: Option<String>,
    pub api_key: Option<String>,

    // Internal mode fields
    pub bearer_token: Option<String>,
    pub mcp_svc_secret: Option<String>,
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

impl Config {
    pub fn new_stdio(
        base_url: String,
        api_key: String,
        default_org_id: Option<String>,
        default_project_id: Option<String>,
        toolsets: Vec<String>,
        enable_modules: Vec<String>,
        read_only: bool,
        enable_license: bool,
    ) -> Result<Self> {
        // Extract account ID from API key
        let account_id = extract_account_id_from_api_key(&api_key)?;

        Ok(Config {
            version: env!("CARGO_PKG_VERSION").to_string(),
            read_only,
            toolsets: if toolsets.is_empty() {
                vec!["default".to_string()]
            } else {
                toolsets
            },
            enable_modules,
            debug: false,
            enable_license,
            internal: false,
            base_url: Some(base_url),
            account_id: Some(account_id),
            default_org_id,
            default_project_id,
            api_key: Some(api_key),
            // Internal fields set to None
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
        })
    }

    pub fn new_internal(
        bearer_token: String,
        mcp_svc_secret: String,
        pipeline_svc_base_url: Option<String>,
        pipeline_svc_secret: Option<String>,
        toolsets: Vec<String>,
        enable_modules: Vec<String>,
        read_only: bool,
        enable_license: bool,
    ) -> Result<Self> {
        Ok(Config {
            version: env!("CARGO_PKG_VERSION").to_string(),
            read_only: true, // Internal mode is read-only for now
            toolsets: if toolsets.is_empty() {
                vec!["default".to_string()]
            } else {
                toolsets
            },
            enable_modules,
            debug: false,
            enable_license,
            internal: true,
            // External fields set to None
            base_url: None,
            account_id: None, // Will be extracted from bearer token
            default_org_id: None,
            default_project_id: None,
            api_key: None,
            // Internal fields
            bearer_token: Some(bearer_token),
            mcp_svc_secret: Some(mcp_svc_secret),
            pipeline_svc_base_url,
            pipeline_svc_secret,
            // Other internal service fields can be added as needed
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
        })
    }
}

/// Extract account ID from Harness API key
/// API key format: pat.ACCOUNT_ID.TOKEN_ID.<>
fn extract_account_id_from_api_key(api_key: &str) -> Result<String> {
    let parts: Vec<&str> = api_key.split('.').collect();
    if parts.len() < 2 {
        return Err(anyhow!("Invalid API key format"));
    }
    Ok(parts[1].to_string())
}