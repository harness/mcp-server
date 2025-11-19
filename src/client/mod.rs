//! HTTP client implementations for Harness APIs

pub mod dto;

pub use dto::*;

#[cfg(test)]
mod tests;

use anyhow::Result;
use reqwest::Client;
use serde::de::DeserializeOwned;
use std::time::Duration;
use tracing::{debug, error};

/// Base HTTP client for Harness APIs
#[derive(Debug, Clone)]
pub struct HarnessClient {
    client: Client,
    base_url: String,
    api_key: Option<String>,
    bearer_token: Option<String>,
}

impl HarnessClient {
    /// Create a new Harness client
    pub fn new(base_url: String) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client,
            base_url,
            api_key: None,
            bearer_token: None,
        }
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

    /// Make a GET request
    pub async fn get<T: DeserializeOwned>(&self, path: &str) -> Result<T> {
        let url = format!("{}{}", self.base_url, path);
        debug!("Making GET request to: {}", url);

        let mut request = self.client.get(&url);

        // Add authentication headers
        if let Some(ref api_key) = self.api_key {
            request = request.header("x-api-key", api_key);
        }
        if let Some(ref bearer_token) = self.bearer_token {
            request = request.bearer_auth(bearer_token);
        }

        let response = request.send().await?;
        
        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            error!("HTTP request failed: {} - {}", status, text);
            anyhow::bail!("HTTP request failed: {} - {}", status, text);
        }

        let result = response.json::<T>().await?;
        Ok(result)
    }

    /// Make a POST request
    pub async fn post<T: DeserializeOwned, B: serde::Serialize>(
        &self,
        path: &str,
        body: &B,
    ) -> Result<T> {
        let url = format!("{}{}", self.base_url, path);
        debug!("Making POST request to: {}", url);

        let mut request = self.client.post(&url).json(body);

        // Add authentication headers
        if let Some(ref api_key) = self.api_key {
            request = request.header("x-api-key", api_key);
        }
        if let Some(ref bearer_token) = self.bearer_token {
            request = request.bearer_auth(bearer_token);
        }

        let response = request.send().await?;
        
        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            error!("HTTP request failed: {} - {}", status, text);
            anyhow::bail!("HTTP request failed: {} - {}", status, text);
        }

        let result = response.json::<T>().await?;
        Ok(result)
    }
}