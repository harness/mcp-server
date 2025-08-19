// Authentication module for Harness MCP Server
// Handles API key authentication and JWT token validation

use anyhow::Result;
use serde::{Deserialize, Serialize};
use crate::harness::errors::HarnessResult;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthSession {
    pub account_id: String,
    pub user_id: Option<String>,
    pub org_id: Option<String>,
    pub project_id: Option<String>,
}

pub fn extract_account_id_from_api_key(api_key: &str) -> HarnessResult<String> {
    let parts: Vec<&str> = api_key.split('.').collect();
    if parts.len() < 2 {
        return Err(crate::harness::errors::HarnessError::validation("Invalid API key format"));
    }
    Ok(parts[1].to_string())
}

pub async fn authenticate_session(bearer_token: &str, mcp_secret: &str) -> HarnessResult<AuthSession> {
    // TODO: Implement JWT token validation
    // This would validate the bearer token against the MCP service secret
    // and extract user/account information
    
    Ok(AuthSession {
        account_id: "placeholder".to_string(),
        user_id: None,
        org_id: None,
        project_id: None,
    })
}