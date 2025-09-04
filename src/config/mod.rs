use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

use crate::Cli;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub base_url: String,
    pub api_key: String,
    pub account_id: String,
    pub org_id: Option<String>,
    pub project_id: Option<String>,
    pub toolsets: HashSet<String>,
    pub read_only: bool,
}

impl Config {
    pub fn from_cli(cli: &Cli) -> Result<Self> {
        let api_key = cli.api_key
            .clone()
            .or_else(|| std::env::var("HARNESS_API_KEY").ok())
            .ok_or_else(|| anyhow!("HARNESS_API_KEY is required"))?;

        let account_id = extract_account_id_from_api_key(&api_key)?;

        let base_url = cli.base_url
            .clone()
            .or_else(|| std::env::var("HARNESS_BASE_URL").ok())
            .unwrap_or_else(|| "https://app.harness.io".to_string());

        let toolsets = parse_toolsets(&cli.toolsets)?;

        Ok(Config {
            base_url,
            api_key,
            account_id,
            org_id: cli.org_id.clone(),
            project_id: cli.project_id.clone(),
            toolsets,
            read_only: cli.read_only,
        })
    }

    pub fn validate(&self) -> Result<()> {
        if self.api_key.is_empty() {
            return Err(anyhow!("API key cannot be empty"));
        }

        if self.account_id.is_empty() {
            return Err(anyhow!("Account ID cannot be empty"));
        }

        if !self.base_url.starts_with("http://") && !self.base_url.starts_with("https://") {
            return Err(anyhow!("Base URL must start with http:// or https://"));
        }

        Ok(())
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

/// Parse toolsets from comma-separated string
fn parse_toolsets(toolsets_str: &Option<String>) -> Result<HashSet<String>> {
    let mut toolsets = HashSet::new();
    
    if let Some(ts) = toolsets_str {
        if ts == "all" {
            // Add all available toolsets
            toolsets.extend([
                "default".to_string(),
                "pipelines".to_string(),
                "pullrequests".to_string(),
                "services".to_string(),
                "environments".to_string(),
                "infrastructure".to_string(),
                "connectors".to_string(),
                "repositories".to_string(),
                "registries".to_string(),
                "dashboards".to_string(),
                "ccm".to_string(),
                "dbops".to_string(),
                "chaos".to_string(),
                "scs".to_string(),
                "sto".to_string(),
                "logs".to_string(),
                "templates".to_string(),
                "idp".to_string(),
                "audit".to_string(),
            ]);
        } else {
            for toolset in ts.split(',') {
                let toolset = toolset.trim();
                if !toolset.is_empty() {
                    toolsets.insert(toolset.to_string());
                }
            }
        }
    } else {
        // Default toolset only
        toolsets.insert("default".to_string());
    }

    Ok(toolsets)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_account_id_from_api_key() {
        let api_key = "pat.account123.token456.xyz";
        let account_id = extract_account_id_from_api_key(api_key).unwrap();
        assert_eq!(account_id, "account123");
    }

    #[test]
    fn test_extract_account_id_invalid_format() {
        let api_key = "invalid_key";
        let result = extract_account_id_from_api_key(api_key);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_toolsets_all() {
        let toolsets = parse_toolsets(&Some("all".to_string())).unwrap();
        assert!(toolsets.contains("default"));
        assert!(toolsets.contains("pipelines"));
        assert!(toolsets.contains("ccm"));
    }

    #[test]
    fn test_parse_toolsets_specific() {
        let toolsets = parse_toolsets(&Some("pipelines,ccm,logs".to_string())).unwrap();
        assert_eq!(toolsets.len(), 3);
        assert!(toolsets.contains("pipelines"));
        assert!(toolsets.contains("ccm"));
        assert!(toolsets.contains("logs"));
    }

    #[test]
    fn test_parse_toolsets_default() {
        let toolsets = parse_toolsets(&None).unwrap();
        assert_eq!(toolsets.len(), 1);
        assert!(toolsets.contains("default"));
    }
}