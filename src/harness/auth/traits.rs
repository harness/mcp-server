use anyhow::Result;
use async_trait::async_trait;

/// Provider trait for different authentication mechanisms
#[async_trait]
pub trait AuthProvider: Send + Sync {
    /// Get authentication header key and value
    async fn get_header(&self) -> Result<(String, String)>;
}

/// API Key authentication provider
pub struct ApiKeyProvider {
    api_key: String,
}

impl ApiKeyProvider {
    pub fn new(api_key: String) -> Self {
        Self { api_key }
    }
}

#[async_trait]
impl AuthProvider for ApiKeyProvider {
    async fn get_header(&self) -> Result<(String, String)> {
        Ok(("x-api-key".to_string(), self.api_key.clone()))
    }
}

/// Bearer token authentication provider
pub struct BearerTokenProvider {
    token: String,
}

impl BearerTokenProvider {
    pub fn new(token: String) -> Self {
        Self { token }
    }
}

#[async_trait]
impl AuthProvider for BearerTokenProvider {
    async fn get_header(&self) -> Result<(String, String)> {
        Ok(("Authorization".to_string(), format!("Bearer {}", self.token)))
    }
}