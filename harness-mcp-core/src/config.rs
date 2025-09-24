use clap::Parser;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Parser, Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    /// Version of the server
    #[arg(skip)]
    pub version: Option<String>,

    /// Base URL for Harness
    #[arg(long, env = "HARNESS_BASE_URL", default_value = "https://app.harness.io")]
    pub base_url: String,

    /// API key for authentication
    #[arg(long, env = "HARNESS_API_KEY")]
    pub api_key: Option<String>,

    /// Default organization ID
    #[arg(long, env = "HARNESS_DEFAULT_ORG_ID")]
    pub default_org_id: Option<String>,

    /// Default project ID
    #[arg(long, env = "HARNESS_DEFAULT_PROJECT_ID")]
    pub default_project_id: Option<String>,

    /// Comma-separated list of toolsets to enable
    #[arg(long, env = "HARNESS_TOOLSETS", value_delimiter = ',')]
    pub toolsets: Vec<String>,

    /// Comma-separated list of modules to enable
    #[arg(long, env = "HARNESS_ENABLE_MODULES", value_delimiter = ',')]
    pub enable_modules: Vec<String>,

    /// Enable license validation
    #[arg(long, env = "HARNESS_ENABLE_LICENSE")]
    pub enable_license: bool,

    /// Restrict to read-only operations
    #[arg(long, env = "HARNESS_READ_ONLY")]
    pub read_only: bool,

    /// Path to log file
    #[arg(long, env = "HARNESS_LOG_FILE")]
    pub log_file: Option<String>,

    /// Enable debug logging
    #[arg(long, env = "HARNESS_DEBUG")]
    pub debug: bool,

    /// Directory for output files
    #[arg(long, env = "HARNESS_OUTPUT_DIR")]
    pub output_dir: Option<String>,

    /// Bearer token for internal authentication
    #[arg(skip)]
    pub bearer_token: Option<String>,

    /// Internal mode flag
    #[arg(skip)]
    pub internal: bool,

    /// Account ID (extracted from API key)
    #[arg(skip)]
    pub account_id: Option<String>,

    /// Service URLs and secrets for internal mode
    #[arg(skip)]
    pub service_configs: HashMap<String, ServiceConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceConfig {
    pub base_url: String,
    pub secret: Option<String>,
}

impl Config {
    /// Extract account ID from API key
    pub fn extract_account_id(&mut self) -> crate::error::Result<()> {
        if let Some(ref api_key) = self.api_key {
            let parts: Vec<&str> = api_key.split('.').collect();
            if parts.len() >= 2 {
                self.account_id = Some(parts[1].to_string());
            } else {
                return Err(crate::error::McpError::InvalidApiKey);
            }
        }
        Ok(())
    }

    /// Get service configuration
    pub fn get_service_config(&self, service: &str) -> Option<&ServiceConfig> {
        self.service_configs.get(service)
    }

    /// Add service configuration
    pub fn add_service_config(&mut self, service: String, config: ServiceConfig) {
        self.service_configs.insert(service, config);
    }
}

impl Default for Config {
    fn default() -> Self {
        Self {
            version: Some("0.1.0".to_string()),
            base_url: "https://app.harness.io".to_string(),
            api_key: None,
            default_org_id: None,
            default_project_id: None,
            toolsets: vec!["default".to_string()],
            enable_modules: Vec::new(),
            enable_license: false,
            read_only: false,
            log_file: None,
            debug: false,
            output_dir: None,
            bearer_token: None,
            internal: false,
            account_id: None,
            service_configs: HashMap::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_default() {
        let config = Config::default();
        assert_eq!(config.base_url, "https://app.harness.io");
        assert_eq!(config.toolsets, vec!["default"]);
        assert!(!config.read_only);
        assert!(!config.debug);
        assert!(!config.enable_license);
        assert!(!config.internal);
        assert_eq!(config.version, Some("0.1.0".to_string()));
    }

    #[test]
    fn test_extract_account_id_valid() {
        let mut config = Config::default();
        config.api_key = Some("pat.account123.token456.secret789".to_string());
        
        let result = config.extract_account_id();
        assert!(result.is_ok());
        assert_eq!(config.account_id, Some("account123".to_string()));
    }

    #[test]
    fn test_extract_account_id_invalid() {
        let mut config = Config::default();
        config.api_key = Some("invalid_key".to_string());
        
        let result = config.extract_account_id();
        assert!(result.is_err());
    }

    #[test]
    fn test_extract_account_id_none() {
        let mut config = Config::default();
        config.api_key = None;
        
        let result = config.extract_account_id();
        assert!(result.is_ok());
        assert_eq!(config.account_id, None);
    }

    #[test]
    fn test_service_config_operations() {
        let mut config = Config::default();
        
        let service_config = ServiceConfig {
            base_url: "https://service.example.com".to_string(),
            secret: Some("secret123".to_string()),
        };
        
        config.add_service_config("test_service".to_string(), service_config.clone());
        
        let retrieved = config.get_service_config("test_service");
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().base_url, service_config.base_url);
        assert_eq!(retrieved.unwrap().secret, service_config.secret);
        
        let missing = config.get_service_config("missing_service");
        assert!(missing.is_none());
    }

    #[test]
    fn test_config_serialization() {
        let config = Config::default();
        let serialized = serde_json::to_string(&config);
        assert!(serialized.is_ok());
        
        let deserialized: Result<Config, _> = serde_json::from_str(&serialized.unwrap());
        assert!(deserialized.is_ok());
        
        let deserialized_config = deserialized.unwrap();
        assert_eq!(config.base_url, deserialized_config.base_url);
        assert_eq!(config.toolsets, deserialized_config.toolsets);
    }
}