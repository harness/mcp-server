//! HTTP client for Harness services

use crate::error::{ClientError, ClientResult};
use harness_mcp_core::config::Config;
use reqwest::{Client, RequestBuilder};
use serde::de::DeserializeOwned;
use std::time::Duration;
use tracing::{debug, error};

/// Harness HTTP client
pub struct HarnessClient {
    client: Client,
    base_url: String,
    api_key: Option<String>,
    bearer_token: Option<String>,
}

impl HarnessClient {
    /// Create a new Harness client
    pub fn new(config: &Config) -> ClientResult<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .map_err(ClientError::Http)?;

        Ok(Self {
            client,
            base_url: config.get_base_url().to_string(),
            api_key: config.api_key.clone(),
            bearer_token: config.bearer_token.clone(),
        })
    }

    /// Create a new client with custom base URL and timeout
    pub fn with_config(
        base_url: String,
        api_key: Option<String>,
        bearer_token: Option<String>,
        timeout: Duration,
    ) -> ClientResult<Self> {
        let client = Client::builder()
            .timeout(timeout)
            .build()
            .map_err(ClientError::Http)?;

        Ok(Self {
            client,
            base_url,
            api_key,
            bearer_token,
        })
    }

    /// Create a GET request
    pub fn get(&self, path: &str) -> RequestBuilder {
        let url = format!(
            "{}/{}",
            self.base_url.trim_end_matches('/'),
            path.trim_start_matches('/')
        );
        debug!("Creating GET request to: {}", url);

        let mut request = self.client.get(&url);
        request = self.add_auth_headers(request);
        request
    }

    /// Create a POST request
    pub fn post(&self, path: &str) -> RequestBuilder {
        let url = format!(
            "{}/{}",
            self.base_url.trim_end_matches('/'),
            path.trim_start_matches('/')
        );
        debug!("Creating POST request to: {}", url);

        let mut request = self.client.post(&url);
        request = self.add_auth_headers(request);
        request
    }

    /// Create a PUT request
    pub fn put(&self, path: &str) -> RequestBuilder {
        let url = format!(
            "{}/{}",
            self.base_url.trim_end_matches('/'),
            path.trim_start_matches('/')
        );
        debug!("Creating PUT request to: {}", url);

        let mut request = self.client.put(&url);
        request = self.add_auth_headers(request);
        request
    }

    /// Create a DELETE request
    pub fn delete(&self, path: &str) -> RequestBuilder {
        let url = format!(
            "{}/{}",
            self.base_url.trim_end_matches('/'),
            path.trim_start_matches('/')
        );
        debug!("Creating DELETE request to: {}", url);

        let mut request = self.client.delete(&url);
        request = self.add_auth_headers(request);
        request
    }

    /// Execute a request and deserialize the response
    pub async fn execute<T: DeserializeOwned>(&self, request: RequestBuilder) -> ClientResult<T> {
        let response = request.send().await.map_err(ClientError::Http)?;

        if !response.status().is_success() {
            let status = response.status();
            error!("Request failed with status: {}", status);
            let error_text = response.text().await.unwrap_or_default();
            return Err(ClientError::api(status.to_string(), error_text));
        }

        let response_text = response.text().await.map_err(ClientError::Http)?;
        debug!("Response body: {}", response_text);

        serde_json::from_str(&response_text).map_err(ClientError::Serialization)
    }

    /// Add authentication headers to a request
    fn add_auth_headers(&self, mut request: RequestBuilder) -> RequestBuilder {
        if let Some(api_key) = &self.api_key {
            request = request.header("x-api-key", api_key);
        }

        if let Some(bearer_token) = &self.bearer_token {
            request = request.header("Authorization", format!("Bearer {}", bearer_token));
        }

        request = request.header("Content-Type", "application/json");
        request
    }
}
