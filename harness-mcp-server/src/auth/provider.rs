use anyhow::Result;
use async_trait::async_trait;
use reqwest::RequestBuilder;

#[async_trait]
pub trait AuthProvider: Send + Sync {
    async fn add_auth(&self, request: RequestBuilder) -> Result<RequestBuilder>;
    async fn get_header(&self) -> Result<(String, String)>;
}

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
    async fn add_auth(&self, request: RequestBuilder) -> Result<RequestBuilder> {
        Ok(request.header("x-api-key", &self.api_key))
    }
    
    async fn get_header(&self) -> Result<(String, String)> {
        Ok(("x-api-key".to_string(), self.api_key.clone()))
    }
}

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
    async fn add_auth(&self, request: RequestBuilder) -> Result<RequestBuilder> {
        Ok(request.bearer_auth(&self.token))
    }
    
    async fn get_header(&self) -> Result<(String, String)> {
        Ok(("Authorization".to_string(), format!("Bearer {}", self.token)))
    }
}