use crate::auth::Session;
use crate::config::Config;
use crate::error::{HarnessError, Result};
use reqwest::{Client, Method, RequestBuilder, Response};
use serde::Serialize;
use std::time::Duration;
use tracing::{debug, error, warn};
use url::Url;

/// HTTP client wrapper for Harness API calls
pub struct HarnessHttpClient {
    client: Client,
    base_url: String,
    api_key: Option<String>,
    bearer_token: Option<String>,
}

impl HarnessHttpClient {
    /// Create a new HTTP client from configuration
    pub fn new(config: &Config) -> Result<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent("harness-mcp-server-rust/0.1.0")
            .build()
            .map_err(|e| HarnessError::http(format!("Failed to create HTTP client: {}", e)))?;

        let base_url = config
            .get_base_url()
            .unwrap_or("https://app.harness.io")
            .to_string();

        Ok(Self {
            client,
            base_url,
            api_key: config.get_api_key().map(|s| s.to_string()),
            bearer_token: config.get_bearer_token().map(|s| s.to_string()),
        })
    }

    /// Create a new HTTP client with custom base URL
    pub fn with_base_url(base_url: String) -> Result<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent("harness-mcp-server-rust/0.1.0")
            .build()
            .map_err(|e| HarnessError::http(format!("Failed to create HTTP client: {}", e)))?;

        Ok(Self {
            client,
            base_url,
            api_key: None,
            bearer_token: None,
        })
    }

    /// Set API key for authentication
    pub fn with_api_key(mut self, api_key: String) -> Self {
        self.api_key = Some(api_key);
        self
    }

    /// Set bearer token for authentication
    pub fn with_bearer_token(mut self, bearer_token: String) -> Self {
        self.bearer_token = Some(bearer_token);
        self
    }

    /// Build a full URL from a path
    pub fn build_url(&self, path: &str) -> Result<Url> {
        let base = Url::parse(&self.base_url)
            .map_err(|e| HarnessError::http(format!("Invalid base URL: {}", e)))?;
        
        base.join(path)
            .map_err(|e| HarnessError::http(format!("Failed to build URL: {}", e)))
    }

    /// Create a request builder with authentication
    fn create_request(&self, method: Method, url: Url) -> RequestBuilder {
        let mut builder = self.client.request(method, url);

        // Add authentication headers
        if let Some(api_key) = &self.api_key {
            builder = builder.header("x-api-key", api_key);
        }

        if let Some(bearer_token) = &self.bearer_token {
            builder = builder.bearer_auth(bearer_token);
        }

        builder
    }

    /// Make a GET request
    pub async fn get(&self, path: &str) -> Result<Response> {
        let url = self.build_url(path)?;
        debug!("Making GET request to: {}", url);

        let response = self
            .create_request(Method::GET, url)
            .send()
            .await
            .map_err(|e| HarnessError::http(format!("GET request failed: {}", e)))?;

        self.handle_response(response).await
    }

    /// Make a POST request with JSON body
    pub async fn post_json<T: Serialize>(&self, path: &str, body: &T) -> Result<Response> {
        let url = self.build_url(path)?;
        debug!("Making POST request to: {}", url);

        let response = self
            .create_request(Method::POST, url)
            .json(body)
            .send()
            .await
            .map_err(|e| HarnessError::http(format!("POST request failed: {}", e)))?;

        self.handle_response(response).await
    }

    /// Make a PUT request with JSON body
    pub async fn put_json<T: Serialize>(&self, path: &str, body: &T) -> Result<Response> {
        let url = self.build_url(path)?;
        debug!("Making PUT request to: {}", url);

        let response = self
            .create_request(Method::PUT, url)
            .json(body)
            .send()
            .await
            .map_err(|e| HarnessError::http(format!("PUT request failed: {}", e)))?;

        self.handle_response(response).await
    }

    /// Make a DELETE request
    pub async fn delete(&self, path: &str) -> Result<Response> {
        let url = self.build_url(path)?;
        debug!("Making DELETE request to: {}", url);

        let response = self
            .create_request(Method::DELETE, url)
            .send()
            .await
            .map_err(|e| HarnessError::http(format!("DELETE request failed: {}", e)))?;

        self.handle_response(response).await
    }

    /// Handle HTTP response and check for errors
    async fn handle_response(&self, response: Response) -> Result<Response> {
        let status = response.status();
        
        if status.is_success() {
            debug!("Request successful: {}", status);
            Ok(response)
        } else if status.is_client_error() {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown client error".to_string());
            
            error!("Client error {}: {}", status, error_text);
            Err(HarnessError::http(format!("Client error {}: {}", status, error_text)))
        } else if status.is_server_error() {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown server error".to_string());
            
            error!("Server error {}: {}", status, error_text);
            Err(HarnessError::http(format!("Server error {}: {}", status, error_text)))
        } else {
            warn!("Unexpected status code: {}", status);
            Ok(response)
        }
    }

    /// Get JSON response from a path
    pub async fn get_json<T>(&self, path: &str) -> Result<T>
    where
        T: serde::de::DeserializeOwned,
    {
        let response = self.get(path).await?;
        let json = response
            .json::<T>()
            .await
            .map_err(|e| HarnessError::http(format!("Failed to parse JSON: {}", e)))?;
        Ok(json)
    }

    /// Post JSON and get JSON response
    pub async fn post_json_response<T, R>(&self, path: &str, body: &T) -> Result<R>
    where
        T: Serialize,
        R: serde::de::DeserializeOwned,
    {
        let response = self.post_json(path, body).await?;
        let json = response
            .json::<R>()
            .await
            .map_err(|e| HarnessError::http(format!("Failed to parse JSON: {}", e)))?;
        Ok(json)
    }
}

/// Create an HTTP client from session and config
pub fn create_client_from_session(_session: &Session, config: &Config) -> Result<HarnessHttpClient> {
    let mut client = HarnessHttpClient::new(config)?;
    
    if let Some(api_key) = config.get_api_key() {
        client = client.with_api_key(api_key.to_string());
    }
    
    if let Some(bearer_token) = config.get_bearer_token() {
        client = client.with_bearer_token(bearer_token.to_string());
    }
    
    Ok(client)
}

/// Build query parameters for pagination
pub fn build_pagination_params(page: i32, limit: i32) -> Vec<(String, String)> {
    vec![
        ("page".to_string(), page.to_string()),
        ("limit".to_string(), limit.to_string()),
    ]
}

/// Build query parameters for scope
pub fn build_scope_params(
    account_id: &str,
    org_id: Option<&str>,
    project_id: Option<&str>,
) -> Vec<(String, String)> {
    let mut params = vec![("accountIdentifier".to_string(), account_id.to_string())];
    
    if let Some(org) = org_id {
        params.push(("orgIdentifier".to_string(), org.to_string()));
    }
    
    if let Some(project) = project_id {
        params.push(("projectIdentifier".to_string(), project.to_string()));
    }
    
    params
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_url() {
        let client = HarnessHttpClient::with_base_url("https://app.harness.io".to_string()).unwrap();
        let url = client.build_url("/ng/api/connectors").unwrap();
        assert_eq!(url.as_str(), "https://app.harness.io/ng/api/connectors");
    }

    #[test]
    fn test_build_pagination_params() {
        let params = build_pagination_params(2, 50);
        assert_eq!(params.len(), 2);
        assert!(params.contains(&("page".to_string(), "2".to_string())));
        assert!(params.contains(&("limit".to_string(), "50".to_string())));
    }

    #[test]
    fn test_build_scope_params() {
        let params = build_scope_params("acc123", Some("org123"), Some("proj123"));
        assert_eq!(params.len(), 3);
        assert!(params.contains(&("accountIdentifier".to_string(), "acc123".to_string())));
        assert!(params.contains(&("orgIdentifier".to_string(), "org123".to_string())));
        assert!(params.contains(&("projectIdentifier".to_string(), "proj123".to_string())));
    }
}