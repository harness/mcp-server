use super::AuthProvider;
use anyhow::Result;
use async_trait::async_trait;

const API_KEY_HEADER_NAME: &str = "x-api-key";

/// API Key authentication provider
#[derive(Debug, Clone)]
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
        Ok((API_KEY_HEADER_NAME.to_string(), self.api_key.clone()))
    }
}