use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    // Common fields
    pub version: String,
    pub read_only: bool,
    pub toolsets: Vec<String>,
    pub enable_modules: Vec<String>,
    pub debug: bool,
    pub enable_license: bool,
    pub transport: TransportType,

    // External mode (stdio/http)
    pub base_url: Option<String>,
    pub account_id: Option<String>,
    pub default_org_id: Option<String>,
    pub default_project_id: Option<String>,
    pub api_key: Option<String>,

    // HTTP server specific
    pub http_port: Option<u16>,
    pub http_path: Option<String>,

    // Internal mode
    pub internal: bool,
    pub bearer_token: Option<String>,
    pub mcp_svc_secret: Option<String>,

    // Internal service configurations
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TransportType {
    Stdio,
    Http,
    Internal,
}

impl Config {
    pub fn new_stdio(
        base_url: String,
        account_id: String,
        api_key: String,
        default_org_id: Option<String>,
        default_project_id: Option<String>,
        toolsets: Vec<String>,
        enable_modules: Vec<String>,
        read_only: bool,
        enable_license: bool,
    ) -> Self {
        Self {
            version: env!("CARGO_PKG_VERSION").to_string(),
            read_only,
            toolsets,
            enable_modules,
            debug: false,
            enable_license,
            transport: TransportType::Stdio,
            base_url: Some(base_url),
            account_id: Some(account_id),
            default_org_id,
            default_project_id,
            api_key: Some(api_key),
            http_port: None,
            http_path: None,
            internal: false,
            bearer_token: None,
            mcp_svc_secret: None,
            // Initialize all internal service configs to None
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
        }
    }

    pub fn new_http(
        http_port: u16,
        http_path: String,
        toolsets: Vec<String>,
        enable_modules: Vec<String>,
        read_only: bool,
        enable_license: bool,
    ) -> Self {
        Self {
            version: env!("CARGO_PKG_VERSION").to_string(),
            read_only,
            toolsets,
            enable_modules,
            debug: false,
            enable_license,
            transport: TransportType::Http,
            base_url: None,
            account_id: None,
            default_org_id: None,
            default_project_id: None,
            api_key: None,
            http_port: Some(http_port),
            http_path: Some(http_path),
            internal: false,
            bearer_token: None,
            mcp_svc_secret: None,
            // Initialize all internal service configs to None
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
        }
    }

    pub fn new_internal(
        bearer_token: String,
        mcp_svc_secret: String,
        toolsets: Vec<String>,
        enable_modules: Vec<String>,
        enable_license: bool,
    ) -> Self {
        Self {
            version: env!("CARGO_PKG_VERSION").to_string(),
            read_only: true, // Internal mode is read-only by default
            toolsets,
            enable_modules,
            debug: false,
            enable_license,
            transport: TransportType::Internal,
            base_url: None,
            account_id: None,
            default_org_id: None,
            default_project_id: None,
            api_key: None,
            http_port: None,
            http_path: None,
            internal: true,
            bearer_token: Some(bearer_token),
            mcp_svc_secret: Some(mcp_svc_secret),
            // Initialize all internal service configs to None - these would be set from environment
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
        }
    }

    // Getter methods
    pub fn base_url(&self) -> Option<&str> {
        self.base_url.as_deref()
    }

    pub fn account_id(&self) -> Option<&str> {
        self.account_id.as_deref()
    }

    pub fn api_key(&self) -> Option<&str> {
        self.api_key.as_deref()
    }

    pub fn http_port(&self) -> Option<u16> {
        self.http_port
    }

    pub fn http_path(&self) -> Option<&str> {
        self.http_path.as_deref()
    }

    pub fn is_internal(&self) -> bool {
        self.internal
    }

    pub fn is_read_only(&self) -> bool {
        self.read_only
    }
}