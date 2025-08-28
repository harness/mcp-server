use anyhow::Result;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthSession {
    pub account_id: String,
    pub user_id: Option<String>,
    pub token: String,
}

pub fn authenticate_session(bearer_token: &str, mcp_secret: &str) -> Result<AuthSession> {
    // TODO: Implement actual authentication logic
    // For now, return a mock session
    Ok(AuthSession {
        account_id: "mock_account".to_string(),
        user_id: Some("mock_user".to_string()),
        token: bearer_token.to_string(),
    })
}

pub fn extract_account_id_from_api_key(api_key: &str) -> Result<String> {
    let parts: Vec<&str> = api_key.split('.').collect();
    if parts.len() < 2 {
        return Err(anyhow::anyhow!("Invalid API key format"));
    }
    Ok(parts[1].to_string())
}