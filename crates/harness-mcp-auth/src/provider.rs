use crate::{AuthError, Result};
use async_trait::async_trait;
use std::collections::HashMap;
use tracing::debug;

/// Authentication provider trait
#[async_trait]
pub trait AuthProvider: Send + Sync {
    /// Get authentication headers for HTTP requests
    async fn get_auth_headers(&self) -> Result<HashMap<String, String>>;

    /// Validate the authentication credentials
    async fn validate(&self) -> Result<()>;

    /// Get the account ID associated with this authentication
    async fn get_account_id(&self) -> Result<String>;
}

/// API key authentication provider
#[derive(Clone)]
pub struct ApiKeyProvider {
    api_key: String,
    account_id: String,
}

impl ApiKeyProvider {
    /// Create a new API key provider
    pub fn new(api_key: String) -> Self {
        let account_id = extract_account_id_from_api_key(&api_key)
            .unwrap_or_else(|_| "unknown".to_string());
        
        Self { api_key, account_id }
    }

    /// Create a new API key provider with explicit account ID
    pub fn with_account_id(api_key: String, account_id: String) -> Self {
        Self { api_key, account_id }
    }
}

#[async_trait]
impl AuthProvider for ApiKeyProvider {
    async fn get_auth_headers(&self) -> Result<HashMap<String, String>> {
        let mut headers = HashMap::new();
        headers.insert("x-api-key".to_string(), self.api_key.clone());
        debug!("Added API key authentication header");
        Ok(headers)
    }

    async fn validate(&self) -> Result<()> {
        if self.api_key.is_empty() {
            return Err(AuthError::InvalidCredentials);
        }

        // Basic format validation for Harness API keys
        if !self.api_key.starts_with("pat.") {
            return Err(AuthError::InvalidTokenFormat);
        }

        Ok(())
    }

    async fn get_account_id(&self) -> Result<String> {
        Ok(self.account_id.clone())
    }
}

/// Bearer token authentication provider
#[derive(Clone)]
pub struct BearerTokenProvider {
    token: String,
    account_id: Option<String>,
}

impl BearerTokenProvider {
    /// Create a new bearer token provider
    pub fn new(token: String) -> Self {
        Self {
            token,
            account_id: None,
        }
    }

    /// Create a new bearer token provider with account ID
    pub fn with_account_id(token: String, account_id: String) -> Self {
        Self {
            token,
            account_id: Some(account_id),
        }
    }

    /// Set the account ID
    pub fn set_account_id(&mut self, account_id: String) {
        self.account_id = Some(account_id);
    }
}

#[async_trait]
impl AuthProvider for BearerTokenProvider {
    async fn get_auth_headers(&self) -> Result<HashMap<String, String>> {
        let mut headers = HashMap::new();
        headers.insert("Authorization".to_string(), format!("Bearer {}", self.token));
        debug!("Added Bearer token authentication header");
        Ok(headers)
    }

    async fn validate(&self) -> Result<()> {
        if self.token.is_empty() {
            return Err(AuthError::InvalidCredentials);
        }

        Ok(())
    }

    async fn get_account_id(&self) -> Result<String> {
        self.account_id
            .clone()
            .ok_or(AuthError::AccountNotFound)
    }
}

/// Service token authentication provider for internal services
#[derive(Clone)]
pub struct ServiceTokenProvider {
    service_secret: String,
    service_name: String,
    account_id: String,
}

impl ServiceTokenProvider {
    /// Create a new service token provider
    pub fn new(service_secret: String, service_name: String, account_id: String) -> Self {
        Self {
            service_secret,
            service_name,
            account_id,
        }
    }
}

#[async_trait]
impl AuthProvider for ServiceTokenProvider {
    async fn get_auth_headers(&self) -> Result<HashMap<String, String>> {
        let mut headers = HashMap::new();
        headers.insert("X-Service-Secret".to_string(), self.service_secret.clone());
        headers.insert("X-Service-Name".to_string(), self.service_name.clone());
        debug!("Added service token authentication headers for service: {}", self.service_name);
        Ok(headers)
    }

    async fn validate(&self) -> Result<()> {
        if self.service_secret.is_empty() || self.service_name.is_empty() {
            return Err(AuthError::InvalidCredentials);
        }

        Ok(())
    }

    async fn get_account_id(&self) -> Result<String> {
        Ok(self.account_id.clone())
    }
}

/// Extract account ID from Harness API key
/// API key format: pat.ACCOUNT_ID.TOKEN_ID.<signature>
fn extract_account_id_from_api_key(api_key: &str) -> Result<String> {
    let parts: Vec<&str> = api_key.split('.').collect();
    if parts.len() < 2 {
        return Err(AuthError::InvalidTokenFormat);
    }
    Ok(parts[1].to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_account_id_from_api_key() {
        let api_key = "pat.account123.token456.signature789";
        let account_id = extract_account_id_from_api_key(api_key).unwrap();
        assert_eq!(account_id, "account123");
    }

    #[test]
    fn test_extract_account_id_invalid_format() {
        let api_key = "invalid_key";
        let result = extract_account_id_from_api_key(api_key);
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_api_key_provider() {
        let provider = ApiKeyProvider::new("pat.account123.token456.signature789".to_string());
        
        let headers = provider.get_auth_headers().await.unwrap();
        assert!(headers.contains_key("x-api-key"));
        
        let account_id = provider.get_account_id().await.unwrap();
        assert_eq!(account_id, "account123");
        
        assert!(provider.validate().await.is_ok());
    }

    #[tokio::test]
    async fn test_bearer_token_provider() {
        let provider = BearerTokenProvider::with_account_id(
            "test_token".to_string(),
            "account123".to_string(),
        );
        
        let headers = provider.get_auth_headers().await.unwrap();
        assert!(headers.contains_key("Authorization"));
        assert!(headers["Authorization"].starts_with("Bearer "));
        
        let account_id = provider.get_account_id().await.unwrap();
        assert_eq!(account_id, "account123");
        
        assert!(provider.validate().await.is_ok());
    }

    #[tokio::test]
    async fn test_service_token_provider() {
        let provider = ServiceTokenProvider::new(
            "secret123".to_string(),
            "test-service".to_string(),
            "account123".to_string(),
        );
        
        let headers = provider.get_auth_headers().await.unwrap();
        assert!(headers.contains_key("X-Service-Secret"));
        assert!(headers.contains_key("X-Service-Name"));
        
        let account_id = provider.get_account_id().await.unwrap();
        assert_eq!(account_id, "account123");
        
        assert!(provider.validate().await.is_ok());
    }

    #[tokio::test]
    async fn test_invalid_api_key() {
        let provider = ApiKeyProvider::new("invalid_key".to_string());
        assert!(provider.validate().await.is_err());
    }

    #[tokio::test]
    async fn test_empty_bearer_token() {
        let provider = BearerTokenProvider::new("".to_string());
        assert!(provider.validate().await.is_err());
    }
}