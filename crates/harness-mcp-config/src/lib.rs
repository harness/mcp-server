use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use url::Url;

/// Transport type for the MCP server
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TransportType {
    Stdio,
    Http,
}

/// Configuration for the Harness MCP Server
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    /// Server version
    pub version: String,
    
    /// Transport type
    pub transport: TransportType,
    
    /// Read-only mode
    pub read_only: bool,
    
    /// Enabled toolsets
    pub toolsets: Vec<String>,
    
    /// Enabled modules
    pub enable_modules: Vec<String>,
    
    /// Enable license validation
    pub enable_license: bool,
    
    /// Output directory for files
    pub output_dir: Option<String>,
    
    /// Debug mode
    pub debug: bool,
    
    /// Log file path
    pub log_file_path: Option<String>,
    
    /// Internal mode (for Harness internal use)
    pub internal: bool,
    
    /// External mode configuration
    pub external: Option<ExternalConfig>,
    
    /// Internal mode configuration
    pub internal_config: Option<InternalConfig>,
    
    /// HTTP server configuration
    pub http: Option<HttpConfig>,
}

/// Configuration for external mode
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExternalConfig {
    /// Base URL for Harness
    pub base_url: Url,
    
    /// Account ID
    pub account_id: String,
    
    /// Default organization ID
    pub default_org_id: Option<String>,
    
    /// Default project ID
    pub default_project_id: Option<String>,
    
    /// API key for authentication
    pub api_key: String,
}

/// Configuration for internal mode
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InternalConfig {
    /// Bearer token for authentication
    pub bearer_token: String,
    
    /// Account ID (extracted from session)
    pub account_id: String,
    
    /// Service configurations
    pub services: HashMap<String, ServiceConfig>,
}

/// Service configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceConfig {
    /// Base URL for the service
    pub base_url: Url,
    
    /// Secret for the service
    pub secret: String,
}

/// HTTP server configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpConfig {
    /// Port to listen on
    pub port: u16,
    
    /// Path for MCP endpoint
    pub path: String,
}

impl Config {
    /// Create a new configuration for stdio mode
    pub fn stdio(
        base_url: String,
        account_id: String,
        api_key: String,
        default_org_id: Option<String>,
        default_project_id: Option<String>,
        toolsets: Vec<String>,
        read_only: bool,
        output_dir: Option<String>,
    ) -> Result<Self> {
        let base_url = Url::parse(&base_url)?;
        
        Ok(Self {
            version: env!("CARGO_PKG_VERSION").to_string(),
            transport: TransportType::Stdio,
            read_only,
            toolsets: if toolsets.is_empty() { vec!["default".to_string()] } else { toolsets },
            enable_modules: Vec::new(),
            enable_license: false,
            output_dir,
            debug: false,
            log_file_path: None,
            internal: false,
            external: Some(ExternalConfig {
                base_url,
                account_id,
                default_org_id,
                default_project_id,
                api_key,
            }),
            internal_config: None,
            http: None,
        })
    }
    
    /// Create a new configuration for HTTP server mode
    pub fn http_server(
        port: u16,
        path: String,
        toolsets: Vec<String>,
        read_only: bool,
        output_dir: Option<String>,
    ) -> Self {
        Self {
            version: env!("CARGO_PKG_VERSION").to_string(),
            transport: TransportType::Http,
            read_only,
            toolsets: if toolsets.is_empty() { vec!["default".to_string()] } else { toolsets },
            enable_modules: Vec::new(),
            enable_license: false,
            output_dir,
            debug: false,
            log_file_path: None,
            internal: false,
            external: None,
            internal_config: None,
            http: Some(HttpConfig { port, path }),
        }
    }
    
    /// Create a new configuration for internal mode
    pub fn internal(
        bearer_token: String,
        mcp_svc_secret: String,
        toolsets: Vec<String>,
        read_only: bool,
        output_dir: Option<String>,
    ) -> Self {
        let mut services = HashMap::new();
        
        // Add MCP service configuration
        if let Ok(base_url) = Url::parse("http://localhost:8080") {
            services.insert("mcp".to_string(), ServiceConfig {
                base_url,
                secret: mcp_svc_secret,
            });
        }
        
        Self {
            version: env!("CARGO_PKG_VERSION").to_string(),
            transport: TransportType::Stdio,
            read_only,
            toolsets: if toolsets.is_empty() { vec!["default".to_string()] } else { toolsets },
            enable_modules: Vec::new(),
            enable_license: true,
            output_dir,
            debug: false,
            log_file_path: None,
            internal: true,
            external: None,
            internal_config: Some(InternalConfig {
                bearer_token,
                account_id: String::new(), // Will be populated from session
                services,
            }),
            http: None,
        }
    }
    
    /// Get the base URL for external mode
    pub fn base_url(&self) -> Option<&Url> {
        self.external.as_ref().map(|ext| &ext.base_url)
    }
    
    /// Get the account ID
    pub fn account_id(&self) -> Option<&str> {
        if let Some(ext) = &self.external {
            Some(&ext.account_id)
        } else if let Some(int) = &self.internal_config {
            Some(&int.account_id)
        } else {
            None
        }
    }
    
    /// Get the API key for external mode
    pub fn api_key(&self) -> Option<&str> {
        self.external.as_ref().map(|ext| ext.api_key.as_str())
    }
    
    /// Get the bearer token for internal mode
    pub fn bearer_token(&self) -> Option<&str> {
        self.internal_config.as_ref().map(|int| int.bearer_token.as_str())
    }
    
    /// Check if a toolset is enabled
    pub fn is_toolset_enabled(&self, toolset: &str) -> bool {
        self.toolsets.contains(&toolset.to_string()) || self.toolsets.contains(&"all".to_string())
    }
    
    /// Get service configuration by name
    pub fn get_service_config(&self, service_name: &str) -> Option<&ServiceConfig> {
        self.internal_config
            .as_ref()
            .and_then(|int| int.services.get(service_name))
    }
}

impl Default for Config {
    fn default() -> Self {
        Self {
            version: env!("CARGO_PKG_VERSION").to_string(),
            transport: TransportType::Stdio,
            read_only: false,
            toolsets: vec!["default".to_string()],
            enable_modules: Vec::new(),
            enable_license: false,
            output_dir: None,
            debug: false,
            log_file_path: None,
            internal: false,
            external: None,
            internal_config: None,
            http: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_stdio_config() {
        let config = Config::stdio(
            "https://app.harness.io".to_string(),
            "account123".to_string(),
            "api_key".to_string(),
            Some("org123".to_string()),
            Some("proj123".to_string()),
            vec!["pipelines".to_string()],
            false,
            None,
        ).unwrap();
        
        assert_eq!(config.transport, TransportType::Stdio);
        assert!(!config.read_only);
        assert_eq!(config.toolsets, vec!["pipelines"]);
        assert!(config.external.is_some());
    }

    #[test]
    fn test_http_server_config() {
        let config = Config::http_server(
            8080,
            "/mcp".to_string(),
            vec!["default".to_string()],
            true,
            None,
        );
        
        assert_eq!(config.transport, TransportType::Http);
        assert!(config.read_only);
        assert!(config.http.is_some());
        assert_eq!(config.http.as_ref().unwrap().port, 8080);
    }

    #[test]
    fn test_internal_config() {
        let config = Config::internal(
            "bearer_token".to_string(),
            "mcp_secret".to_string(),
            vec!["all".to_string()],
            true,
            None,
        );
        
        assert!(config.internal);
        assert!(config.enable_license);
        assert!(config.internal_config.is_some());
    }

    #[test]
    fn test_toolset_enabled() {
        let config = Config::default();
        assert!(config.is_toolset_enabled("default"));
        assert!(!config.is_toolset_enabled("pipelines"));
        
        let config_all = Config {
            toolsets: vec!["all".to_string()],
            ..Default::default()
        };
        assert!(config_all.is_toolset_enabled("pipelines"));
        assert!(config_all.is_toolset_enabled("any_toolset"));
    }
}