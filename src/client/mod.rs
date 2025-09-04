//! HTTP client implementations for Harness services

pub mod dto;

use crate::types::{Config, Result, HarnessError};
use reqwest::{Client, RequestBuilder};
use serde::{Deserialize, Serialize};
use std::time::Duration;

/// Base HTTP client for Harness services
#[derive(Clone)]
pub struct HarnessClient {
    client: Client,
    base_url: String,
    api_key: Option<String>,
    bearer_token: Option<String>,
}

impl HarnessClient {
    /// Create a new Harness client
    pub fn new(base_url: String) -> Result<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .map_err(|e| HarnessError::Network(e))?;
            
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
    
    /// Create a GET request
    pub fn get(&self, path: &str) -> RequestBuilder {
        let url = format!("{}/{}", self.base_url.trim_end_matches('/'), path.trim_start_matches('/'));
        let mut request = self.client.get(&url);
        
        // Add authentication headers
        if let Some(api_key) = &self.api_key {
            request = request.header("x-api-key", api_key);
        }
        
        if let Some(bearer_token) = &self.bearer_token {
            request = request.header("Authorization", format!("Bearer {}", bearer_token));
        }
        
        request
    }
    
    /// Create a POST request
    pub fn post(&self, path: &str) -> RequestBuilder {
        let url = format!("{}/{}", self.base_url.trim_end_matches('/'), path.trim_start_matches('/'));
        let mut request = self.client.post(&url);
        
        // Add authentication headers
        if let Some(api_key) = &self.api_key {
            request = request.header("x-api-key", api_key);
        }
        
        if let Some(bearer_token) = &self.bearer_token {
            request = request.header("Authorization", format!("Bearer {}", bearer_token));
        }
        
        request
    }
    
    /// Create a PUT request
    pub fn put(&self, path: &str) -> RequestBuilder {
        let url = format!("{}/{}", self.base_url.trim_end_matches('/'), path.trim_start_matches('/'));
        let mut request = self.client.put(&url);
        
        // Add authentication headers
        if let Some(api_key) = &self.api_key {
            request = request.header("x-api-key", api_key);
        }
        
        if let Some(bearer_token) = &self.bearer_token {
            request = request.header("Authorization", format!("Bearer {}", bearer_token));
        }
        
        request
    }
    
    /// Create a DELETE request
    pub fn delete(&self, path: &str) -> RequestBuilder {
        let url = format!("{}/{}", self.base_url.trim_end_matches('/'), path.trim_start_matches('/'));
        let mut request = self.client.delete(&url);
        
        // Add authentication headers
        if let Some(api_key) = &self.api_key {
            request = request.header("x-api-key", api_key);
        }
        
        if let Some(bearer_token) = &self.bearer_token {
            request = request.header("Authorization", format!("Bearer {}", bearer_token));
        }
        
        request
    }
}

/// Standard API response wrapper
#[derive(Debug, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub status: String,
    pub data: Option<T>,
    pub message: Option<String>,
}

/// Create a service client with proper configuration
pub fn create_service_client(
    config: &Config,
    service_base_url: Option<&str>,
    fallback_base_url: &str,
    service_path: &str,
    service_secret: Option<&str>,
) -> Result<HarnessClient> {
    let base_url = service_base_url
        .unwrap_or(fallback_base_url)
        .trim_end_matches('/')
        .to_string();
        
    let full_url = if service_path.is_empty() {
        base_url
    } else {
        format!("{}/{}", base_url, service_path.trim_start_matches('/'))
    };
    
    let mut client = HarnessClient::new(full_url)?;
    
    // Add authentication
    if let Some(api_key) = &config.api_key {
        client = client.with_api_key(api_key.clone());
    }
    
    if let Some(bearer_token) = &config.bearer_token {
        client = client.with_bearer_token(bearer_token.clone());
    }
    
    Ok(client)
}