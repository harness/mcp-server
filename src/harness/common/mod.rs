//! Common utilities for Harness operations

use crate::types::Result;

/// Scope utilities for Harness API operations
pub mod scope_utils {
    use crate::types::{Config, HarnessError, Result};
    
    /// Extract scope information from configuration
    pub fn extract_scope(config: &Config) -> Result<Scope> {
        let account_id = config.account_id.as_ref()
            .or_else(|| {
                config.api_key.as_ref().and_then(|key| {
                    extract_account_id_from_api_key(key).ok()
                })
            })
            .ok_or_else(|| HarnessError::config("Account ID not available"))?;
            
        Ok(Scope {
            account_id: account_id.clone(),
            org_id: config.default_org_id.clone(),
            project_id: config.default_project_id.clone(),
        })
    }
    
    /// Extract account ID from API key
    fn extract_account_id_from_api_key(api_key: &str) -> Result<String> {
        let parts: Vec<&str> = api_key.split('.').collect();
        if parts.len() < 2 {
            return Err(HarnessError::InvalidApiKey);
        }
        Ok(parts[1].to_string())
    }
    
    /// Scope information for API operations
    #[derive(Debug, Clone)]
    pub struct Scope {
        pub account_id: String,
        pub org_id: Option<String>,
        pub project_id: Option<String>,
    }
    
    impl Scope {
        /// Build query parameters for API requests
        pub fn to_query_params(&self) -> Vec<(String, String)> {
            let mut params = vec![("accountIdentifier".to_string(), self.account_id.clone())];
            
            if let Some(org_id) = &self.org_id {
                params.push(("orgIdentifier".to_string(), org_id.clone()));
            }
            
            if let Some(project_id) = &self.project_id {
                params.push(("projectIdentifier".to_string(), project_id.clone()));
            }
            
            params
        }
    }
}