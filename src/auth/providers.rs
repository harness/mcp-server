use super::*;
use crate::config::{AuthConfig, Config};
use std::sync::Arc;

pub fn create_auth_provider(config: &Config) -> Result<Arc<dyn AuthProvider>> {
    match &config.auth {
        AuthConfig::ApiKey { api_key, .. } => {
            let provider = ApiKeyProvider::new(config.harness.base_url.clone());
            // Store the API key for later use
            Ok(Arc::new(provider))
        }
        AuthConfig::Bearer { mcp_svc_secret, .. } => {
            let provider = JwtProvider::new(mcp_svc_secret.clone());
            Ok(Arc::new(provider))
        }
    }
}

// Extended API key provider with validation
pub struct ValidatingApiKeyProvider {
    base_provider: ApiKeyProvider,
    api_key: String,
}

impl ValidatingApiKeyProvider {
    pub fn new(base_url: String, api_key: String) -> Self {
        Self {
            base_provider: ApiKeyProvider::new(base_url),
            api_key,
        }
    }
}

#[async_trait]
impl AuthProvider for ValidatingApiKeyProvider {
    async fn authenticate(&self, token: &str) -> Result<AuthSession> {
        // Validate that the provided token matches our configured API key
        if token != self.api_key {
            return Err(authentication_error("Invalid API key"));
        }
        
        self.base_provider.authenticate(token).await
    }
    
    fn get_auth_header(&self, session: &AuthSession) -> Result<(String, String)> {
        Ok(("x-api-key".to_string(), self.api_key.clone()))
    }
}

// Create the appropriate provider based on config
pub fn create_configured_auth_provider(config: &Config) -> Result<Arc<dyn AuthProvider>> {
    match &config.auth {
        AuthConfig::ApiKey { api_key, .. } => {
            let provider = ValidatingApiKeyProvider::new(
                config.harness.base_url.clone(),
                api_key.clone(),
            );
            Ok(Arc::new(provider))
        }
        AuthConfig::Bearer { mcp_svc_secret, .. } => {
            let provider = JwtProvider::new(mcp_svc_secret.clone());
            Ok(Arc::new(provider))
        }
    }
}