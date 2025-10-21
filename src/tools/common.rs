use crate::config::Config;
use crate::error::{HarnessError, Result};
use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct Scope {
    pub account_id: String,
    pub org_id: Option<String>,
    pub project_id: Option<String>,
}

impl Scope {
    pub fn from_config_and_params(config: &Config, params: &HashMap<String, Value>) -> Result<Self> {
        let account_id = config.account_id.as_ref()
            .ok_or_else(|| HarnessError::Config(anyhow::anyhow!("Account ID not configured")))?
            .clone();
        
        // Try to get org_id from params, fall back to config default
        let org_id = params.get("org_id")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .or_else(|| config.default_org_id.clone());
        
        // Try to get project_id from params, fall back to config default
        let project_id = params.get("project_id")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .or_else(|| config.default_project_id.clone());
        
        Ok(Scope {
            account_id,
            org_id,
            project_id,
        })
    }
    
    pub fn require_org(&self) -> Result<&str> {
        self.org_id.as_ref()
            .map(|s| s.as_str())
            .ok_or_else(|| HarnessError::MissingParameter("org_id".to_string()))
    }
    
    pub fn require_project(&self) -> Result<&str> {
        self.project_id.as_ref()
            .map(|s| s.as_str())
            .ok_or_else(|| HarnessError::MissingParameter("project_id".to_string()))
    }
}

pub fn create_scope_properties() -> HashMap<String, Value> {
    let mut properties = HashMap::new();
    
    properties.insert(
        "org_id".to_string(),
        serde_json::json!({
            "type": "string",
            "description": "Organization ID (optional if default is configured)"
        })
    );
    
    properties.insert(
        "project_id".to_string(),
        serde_json::json!({
            "type": "string",
            "description": "Project ID (optional if default is configured)"
        })
    );
    
    properties
}