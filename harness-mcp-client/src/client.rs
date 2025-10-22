//! Main Harness API client implementation

use crate::{
    auth::{ApiKeyAuth, BearerTokenAuth, JwtAuth},
    error::{HarnessError, Result},
    types::Scope,
    DEFAULT_BASE_URL, DEFAULT_TIMEOUT_SECS, DEFAULT_RETRY_ATTEMPTS,
};
use reqwest::{Client, RequestBuilder, Response};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tower::{Service, ServiceBuilder};
use tower_http::retry::{RetryLayer, RetryPolicy};
use tracing::{debug, error, info, warn};
use url::Url;

/// Harness API client
#[derive(Clone)]
pub struct HarnessClient {
    client: Client,
    base_url: Url,
    auth: AuthMethod,
    retry_attempts: usize,
}

/// Authentication method
#[derive(Clone)]
pub enum AuthMethod {
    ApiKey(String),
    BearerToken(String),
    Jwt { token: String, secret: String },
}

impl HarnessClient {
    /// Create a new Harness client builder
    pub fn builder() -> HarnessClientBuilder {
        HarnessClientBuilder::new()
    }

    /// Create a new client with API key authentication
    pub fn with_api_key(api_key: impl Into<String>) -> Result<Self> {
        Self::builder()
            .auth_api_key(api_key)
            .build()
    }

    /// Create a new client with bearer token authentication
    pub fn with_bearer_token(token: impl Into<String>) -> Result<Self> {
        Self::builder()
            .auth_bearer_token(token)
            .build()
    }

    /// Create a new client with JWT authentication
    pub fn with_jwt(token: impl Into<String>, secret: impl Into<String>) -> Result<Self> {
        Self::builder()
            .auth_jwt(token, secret)
            .build()
    }

    /// Get the base URL
    pub fn base_url(&self) -> &Url {
        &self.base_url
    }

    /// Extract account ID from API key
    pub fn extract_account_id(&self) -> Result<String> {
        match &self.auth {
            AuthMethod::ApiKey(api_key) => {
                let auth = ApiKeyAuth::new(api_key.clone());
                auth.extract_account_id().map_err(|e| HarnessError::Auth(e.to_string()))
            }
            _ => Err(HarnessError::Auth("Account ID extraction only supported for API key auth".to_string())),
        }
    }

    /// Make a GET request
    pub async fn get(&self, path: &str) -> Result<RequestBuilder> {
        let url = self.base_url.join(path)
            .map_err(|e| HarnessError::Config(format!("Invalid URL path '{}': {}", path, e)))?;
        
        debug!("Making GET request to: {}", url);
        let mut request = self.client.get(url);
        request = self.add_auth_header(request)?;
        Ok(request)
    }

    /// Make a POST request
    pub async fn post(&self, path: &str) -> Result<RequestBuilder> {
        let url = self.base_url.join(path)
            .map_err(|e| HarnessError::Config(format!("Invalid URL path '{}': {}", path, e)))?;
        
        debug!("Making POST request to: {}", url);
        let mut request = self.client.post(url);
        request = self.add_auth_header(request)?;
        Ok(request)
    }

    /// Make a PUT request
    pub async fn put(&self, path: &str) -> Result<RequestBuilder> {
        let url = self.base_url.join(path)
            .map_err(|e| HarnessError::Config(format!("Invalid URL path '{}': {}", path, e)))?;
        
        debug!("Making PUT request to: {}", url);
        let mut request = self.client.put(url);
        request = self.add_auth_header(request)?;
        Ok(request)
    }

    /// Make a DELETE request
    pub async fn delete(&self, path: &str) -> Result<RequestBuilder> {
        let url = self.base_url.join(path)
            .map_err(|e| HarnessError::Config(format!("Invalid URL path '{}': {}", path, e)))?;
        
        debug!("Making DELETE request to: {}", url);
        let mut request = self.client.delete(url);
        request = self.add_auth_header(request)?;
        Ok(request)
    }

    /// Execute a request with retry logic
    pub async fn execute_with_retry(&self, request: RequestBuilder) -> Result<Response> {
        let mut last_error = None;
        
        for attempt in 1..=self.retry_attempts {
            match request.try_clone() {
                Some(cloned_request) => {
                    match cloned_request.send().await {
                        Ok(response) => {
                            if response.status().is_success() {
                                debug!("Request succeeded on attempt {}", attempt);
                                return Ok(response);
                            } else if response.status().is_client_error() {
                                // Don't retry client errors (4xx)
                                let status = response.status().as_u16();
                                let text = response.text().await.unwrap_or_default();
                                return Err(HarnessError::Api { status, message: text });
                            } else {
                                // Retry server errors (5xx)
                                warn!("Request failed with status {} on attempt {}, retrying...", response.status(), attempt);
                                last_error = Some(HarnessError::Api {
                                    status: response.status().as_u16(),
                                    message: response.text().await.unwrap_or_default(),
                                });
                            }
                        }
                        Err(e) => {
                            warn!("Request failed on attempt {}: {}", attempt, e);
                            last_error = Some(HarnessError::Http(e));
                        }
                    }
                }
                None => {
                    return Err(HarnessError::Config("Failed to clone request for retry".to_string()));
                }
            }

            if attempt < self.retry_attempts {
                let delay = Duration::from_millis(1000 * attempt as u64);
                debug!("Waiting {}ms before retry attempt {}", delay.as_millis(), attempt + 1);
                tokio::time::sleep(delay).await;
            }
        }

        Err(last_error.unwrap_or_else(|| HarnessError::Config("No error recorded during retries".to_string())))
    }

    /// Add authentication header to request
    fn add_auth_header(&self, mut request: RequestBuilder) -> Result<RequestBuilder> {
        match &self.auth {
            AuthMethod::ApiKey(api_key) => {
                request = request.header("x-api-key", api_key);
            }
            AuthMethod::BearerToken(token) => {
                request = request.header("Authorization", format!("Bearer {}", token));
            }
            AuthMethod::Jwt { token, .. } => {
                request = request.header("Authorization", format!("Bearer {}", token));
            }
        }
        Ok(request)
    }

    /// Add scope query parameters to request
    pub fn add_scope_params(&self, mut request: RequestBuilder, scope: &Scope) -> RequestBuilder {
        let params = scope.to_query_params();
        for (key, value) in params {
            request = request.query(&[(key, value)]);
        }
        request
    }
}

/// Builder for HarnessClient
pub struct HarnessClientBuilder {
    base_url: Option<String>,
    auth: Option<AuthMethod>,
    timeout: Option<Duration>,
    retry_attempts: Option<usize>,
    user_agent: Option<String>,
}

impl HarnessClientBuilder {
    /// Create a new builder
    pub fn new() -> Self {
        Self {
            base_url: None,
            auth: None,
            timeout: None,
            retry_attempts: None,
            user_agent: None,
        }
    }

    /// Set the base URL
    pub fn base_url(mut self, url: impl Into<String>) -> Self {
        self.base_url = Some(url.into());
        self
    }

    /// Set API key authentication
    pub fn auth_api_key(mut self, api_key: impl Into<String>) -> Self {
        self.auth = Some(AuthMethod::ApiKey(api_key.into()));
        self
    }

    /// Set bearer token authentication
    pub fn auth_bearer_token(mut self, token: impl Into<String>) -> Self {
        self.auth = Some(AuthMethod::BearerToken(token.into()));
        self
    }

    /// Set JWT authentication
    pub fn auth_jwt(mut self, token: impl Into<String>, secret: impl Into<String>) -> Self {
        self.auth = Some(AuthMethod::Jwt {
            token: token.into(),
            secret: secret.into(),
        });
        self
    }

    /// Set request timeout
    pub fn timeout(mut self, timeout: Duration) -> Self {
        self.timeout = Some(timeout);
        self
    }

    /// Set retry attempts
    pub fn retry_attempts(mut self, attempts: usize) -> Self {
        self.retry_attempts = Some(attempts);
        self
    }

    /// Set user agent
    pub fn user_agent(mut self, user_agent: impl Into<String>) -> Self {
        self.user_agent = Some(user_agent.into());
        self
    }

    /// Build the client
    pub fn build(self) -> Result<HarnessClient> {
        let base_url = self.base_url.unwrap_or_else(|| DEFAULT_BASE_URL.to_string());
        let base_url = Url::parse(&base_url)
            .map_err(|e| HarnessError::Config(format!("Invalid base URL '{}': {}", base_url, e)))?;

        let auth = self.auth.ok_or_else(|| HarnessError::Config("Authentication method is required".to_string()))?;

        let timeout = self.timeout.unwrap_or_else(|| Duration::from_secs(DEFAULT_TIMEOUT_SECS));
        let retry_attempts = self.retry_attempts.unwrap_or(DEFAULT_RETRY_ATTEMPTS);

        let mut client_builder = Client::builder()
            .timeout(timeout)
            .gzip(true);

        if let Some(user_agent) = self.user_agent {
            client_builder = client_builder.user_agent(user_agent);
        }

        let client = client_builder.build()
            .map_err(|e| HarnessError::Config(format!("Failed to build HTTP client: {}", e)))?;

        Ok(HarnessClient {
            client,
            base_url,
            auth,
            retry_attempts,
        })
    }
}

impl Default for HarnessClientBuilder {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_client_builder() {
        let client = HarnessClient::builder()
            .base_url("https://app.harness.io")
            .auth_api_key("pat.account123.token456.suffix")
            .timeout(Duration::from_secs(30))
            .retry_attempts(3)
            .user_agent("test-client/1.0")
            .build()
            .unwrap();

        assert_eq!(client.base_url().as_str(), "https://app.harness.io/");
        assert_eq!(client.retry_attempts, 3);
    }

    #[test]
    fn test_api_key_client() {
        let client = HarnessClient::with_api_key("pat.account123.token456.suffix").unwrap();
        let account_id = client.extract_account_id().unwrap();
        assert_eq!(account_id, "account123");
    }

    #[test]
    fn test_bearer_token_client() {
        let client = HarnessClient::with_bearer_token("token123").unwrap();
        assert!(matches!(client.auth, AuthMethod::BearerToken(_)));
    }

    #[test]
    fn test_jwt_client() {
        let client = HarnessClient::with_jwt("token123", "secret456").unwrap();
        assert!(matches!(client.auth, AuthMethod::Jwt { .. }));
    }

    #[test]
    fn test_invalid_base_url() {
        let result = HarnessClient::builder()
            .base_url("invalid-url")
            .auth_api_key("pat.account123.token456.suffix")
            .build();
        
        assert!(result.is_err());
    }

    #[test]
    fn test_missing_auth() {
        let result = HarnessClient::builder()
            .base_url("https://app.harness.io")
            .build();
        
        assert!(result.is_err());
    }
}