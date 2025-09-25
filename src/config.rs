use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    // Common fields
    pub version: String,
    pub read_only: bool,
    pub toolsets: Vec<String>,
    pub enable_modules: Vec<String>,
    pub debug: bool,
    pub output_dir: Option<String>,

    // Server configuration
    pub http_port: u16,
    pub http_path: String,
    pub internal: bool,

    // External mode (API key based)
    pub base_url: String,
    pub account_id: String,
    pub default_org_id: Option<String>,
    pub default_project_id: Option<String>,
    pub api_key: String,

    // Internal mode (bearer token + service secrets)
    pub bearer_token: Option<String>,
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
    pub dashboard_svc_base_url: Option<String>,
    pub dashboard_svc_secret: Option<String>,
    pub scs_svc_secret: Option<String>,
    pub scs_svc_base_url: Option<String>,
    pub sto_svc_secret: Option<String>,
    pub sto_svc_base_url: Option<String>,
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
            version: "0.1.0".to_string(),
            read_only: false,
            toolsets: vec!["default".to_string()],
            enable_modules: vec![],
            debug: false,
            output_dir: None,
            http_port: 8080,
            http_path: "/mcp".to_string(),
            internal: false,
            base_url: "https://app.harness.io".to_string(),
            account_id: String::new(),
            default_org_id: None,
            default_project_id: None,
            api_key: String::new(),
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
            dashboard_svc_base_url: None,
            dashboard_svc_secret: None,
            scs_svc_secret: None,
            scs_svc_base_url: None,
            sto_svc_secret: None,
            sto_svc_base_url: None,
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
    /// Load configuration from environment variables with HARNESS_ prefix
    pub fn from_env() -> Result<Self, figment::Error> {
        use figment::{Figment, providers::{Env, Serialized}};
        
        Figment::new()
            .merge(Serialized::defaults(Config::default()))
            .merge(Env::prefixed("HARNESS_"))
            .extract()
    }
    
    /// Check if the server is running in internal mode
    pub fn is_internal(&self) -> bool {
        self.internal
    }
    
    /// Get the effective base URL for a service
    pub fn get_service_base_url(&self, service: &str) -> String {
        match service {
            "pipeline" => self.pipeline_svc_base_url.clone()
                .unwrap_or_else(|| format!("{}/pipeline", self.base_url)),
            "ng-manager" => self.ng_manager_base_url.clone()
                .unwrap_or_else(|| format!("{}/ng/api", self.base_url)),
            "dashboard" => self.dashboard_svc_base_url.clone()
                .unwrap_or_else(|| format!("{}/dashboard", self.base_url)),
            _ => self.base_url.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_default() {
        let config = Config::default();
        
        assert_eq!(config.version, "0.1.0");
        assert_eq!(config.read_only, false);
        assert_eq!(config.toolsets, vec!["default"]);
        assert_eq!(config.http_port, 8080);
        assert_eq!(config.http_path, "/mcp");
        assert_eq!(config.internal, false);
        assert_eq!(config.base_url, "https://app.harness.io");
        assert_eq!(config.account_id, "");
        assert_eq!(config.api_key, "");
        assert!(config.default_org_id.is_none());
        assert!(config.default_project_id.is_none());
    }

    #[test]
    fn test_config_is_internal() {
        let mut config = Config::default();
        assert!(!config.is_internal());
        
        config.internal = true;
        assert!(config.is_internal());
    }

    #[test]
    fn test_get_service_base_url_pipeline() {
        let config = Config::default();
        let url = config.get_service_base_url("pipeline");
        assert_eq!(url, "https://app.harness.io/pipeline");
    }

    #[test]
    fn test_get_service_base_url_ng_manager() {
        let config = Config::default();
        let url = config.get_service_base_url("ng-manager");
        assert_eq!(url, "https://app.harness.io/ng/api");
    }

    #[test]
    fn test_get_service_base_url_dashboard() {
        let config = Config::default();
        let url = config.get_service_base_url("dashboard");
        assert_eq!(url, "https://app.harness.io/dashboard");
    }

    #[test]
    fn test_get_service_base_url_unknown() {
        let config = Config::default();
        let url = config.get_service_base_url("unknown");
        assert_eq!(url, "https://app.harness.io");
    }

    #[test]
    fn test_get_service_base_url_with_custom_service_url() {
        let mut config = Config::default();
        config.pipeline_svc_base_url = Some("https://custom-pipeline.harness.io".to_string());
        
        let url = config.get_service_base_url("pipeline");
        assert_eq!(url, "https://custom-pipeline.harness.io");
    }

    #[test]
    fn test_config_serialization() {
        let config = Config::default();
        let serialized = serde_json::to_string(&config);
        assert!(serialized.is_ok());
        
        let json_str = serialized.unwrap();
        let deserialized: Result<Config, _> = serde_json::from_str(&json_str);
        assert!(deserialized.is_ok());
        
        let deserialized_config = deserialized.unwrap();
        assert_eq!(config.version, deserialized_config.version);
        assert_eq!(config.base_url, deserialized_config.base_url);
        assert_eq!(config.http_port, deserialized_config.http_port);
    }

    #[test]
    fn test_config_clone() {
        let config = Config::default();
        let cloned = config.clone();
        
        assert_eq!(config.version, cloned.version);
        assert_eq!(config.base_url, cloned.base_url);
        assert_eq!(config.toolsets, cloned.toolsets);
    }

    #[test]
    fn test_config_debug() {
        let config = Config::default();
        let debug_str = format!("{:?}", config);
        assert!(debug_str.contains("Config"));
        assert!(debug_str.contains("version"));
        assert!(debug_str.contains("base_url"));
    }
}