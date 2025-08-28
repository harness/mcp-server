use anyhow::Result;
use super::{Authenticator, AuthSession};

pub struct ApiKeyAuthenticator;

impl ApiKeyAuthenticator {
    pub fn new() -> Self {
        Self
    }

    pub fn extract_account_id(api_key: &str) -> Result<String> {
        let parts: Vec<&str> = api_key.split('.').collect();
        if parts.len() < 2 {
            anyhow::bail!("Invalid API key format");
        }
        Ok(parts[1].to_string())
    }
}

impl Authenticator for ApiKeyAuthenticator {
    async fn authenticate(&self, api_key: &str) -> Result<AuthSession> {
        let account_id = Self::extract_account_id(api_key)?;
        
        Ok(AuthSession {
            account_id,
            user_id: None,
            org_id: None,
            project_id: None,
        })
    }
}