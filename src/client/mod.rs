pub mod harness;
pub mod types;

pub use harness::HarnessClient;
pub use types::*;

use crate::error::{HarnessError, Result};
use reqwest::{Client, RequestBuilder, Response};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tracing::{debug, error, info};
use url::Url;

/// Base HTTP client configuration
#[derive(Debug, Clone)]
pub struct ClientConfig {
    pub base_url: String,
    pub api_key: Option<String>,
    pub bearer_token: Option<String>,
    pub timeout: Duration,
    pub user_agent: String,
}

impl Default for ClientConfig {
    fn default() -> Self {
        Self {
            base_url: "https://app.harness.io".to_string(),
            api_key: None,
            bearer_token: None,
            timeout: Duration::from_secs(30),
            user_agent: format!("harness-mcp-server/{}", env!("CARGO_PKG_VERSION")),
        }
    }
}

/// Generic HTTP client for making API requests
#[derive(Debug, Clone)]
pub struct HttpClient {
    client: Client,
    config: ClientConfig,
}

impl HttpClient {
    pub fn new(config: ClientConfig) -> Result<Self> {
        let client = Client::builder()
            .timeout(config.timeout)
            .user_agent(&config.user_agent)
            .build()
            .map_err(|e| HarnessError::Http(e))?;
        
        Ok(Self { client, config })
    }
    
    pub fn get(&self, path: &str) -> RequestBuilder {
        let url = self.build_url(path);
        debug!("GET {}", url);
        self.add_auth_headers(self.client.get(url))
    }
    
    pub fn post(&self, path: &str) -> RequestBuilder {
        let url = self.build_url(path);
        debug!("POST {}", url);
        self.add_auth_headers(self.client.post(url))
    }
    
    pub fn put(&self, path: &str) -> RequestBuilder {
        let url = self.build_url(path);
        debug!("PUT {}", url);
        self.add_auth_headers(self.client.put(url))
    }
    
    pub fn delete(&self, path: &str) -> RequestBuilder {
        let url = self.build_url(path);
        debug!("DELETE {}", url);
        self.add_auth_headers(self.client.delete(url))
    }
    
    pub async fn execute_json<T>(&self, request: RequestBuilder) -> Result<T>
    where
        T: for<'de> Deserialize<'de>,
    {
        let response = request
            .header("Content-Type", "application/json")
            .header("Accept", "application/json")
            .send()
            .await
            .map_err(|e| HarnessError::Http(e))?;
        
        self.handle_response(response).await
    }
    
    pub async fn execute_raw(&self, request: RequestBuilder) -> Result<Response> {
        let response = request
            .send()
            .await
            .map_err(|e| HarnessError::Http(e))?;
        
        if response.status().is_success() {
            Ok(response)
        } else {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            error!("HTTP request failed: {} - {}", status, error_text);
            Err(HarnessError::Api(format!("HTTP {} - {}", status, error_text)))
        }
    }
    
    async fn handle_response<T>(&self, response: Response) -> Result<T>
    where
        T: for<'de> Deserialize<'de>,
    {
        let status = response.status();
        
        if status.is_success() {
            let text = response.text().await.map_err(|e| HarnessError::Http(e))?;
            debug!("Response body: {}", text);
            
            serde_json::from_str(&text).map_err(|e| {
                error!("Failed to parse JSON response: {}", e);
                HarnessError::Json(e)
            })
        } else {
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            error!("HTTP request failed: {} - {}", status, error_text);
            
            let error_message = if status.as_u16() == 401 {
                "Authentication failed - check your API key or token".to_string()
            } else if status.as_u16() == 403 {
                "Access forbidden - insufficient permissions".to_string()
            } else if status.as_u16() == 404 {
                "Resource not found".to_string()
            } else if status.as_u16() == 429 {
                "Rate limit exceeded - please retry later".to_string()
            } else {
                format!("HTTP {} - {}", status, error_text)
            };
            
            Err(HarnessError::Api(error_message))
        }
    }
    
    fn build_url(&self, path: &str) -> String {
        let base = self.config.base_url.trim_end_matches('/');
        let path = path.trim_start_matches('/');
        format!("{}/{}", base, path)
    }
    
    fn add_auth_headers(&self, mut request: RequestBuilder) -> RequestBuilder {
        if let Some(api_key) = &self.config.api_key {
            request = request.header("x-api-key", api_key);
        }
        
        if let Some(bearer_token) = &self.config.bearer_token {
            request = request.header("Authorization", format!("Bearer {}", bearer_token));
        }
        
        request
    }
}

/// Pagination parameters for list requests
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginationParams {
    pub page: Option<i32>,
    pub size: Option<i32>,
    pub sort: Option<Vec<String>>,
}

impl Default for PaginationParams {
    fn default() -> Self {
        Self {
            page: Some(0),
            size: Some(20),
            sort: None,
        }
    }
}

/// Standard paginated response wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PagedResponse<T> {
    pub content: Vec<T>,
    #[serde(rename = "totalElements")]
    pub total_elements: Option<i64>,
    #[serde(rename = "totalPages")]
    pub total_pages: Option<i32>,
    pub size: Option<i32>,
    pub number: Option<i32>,
    pub first: Option<bool>,
    pub last: Option<bool>,
}

/// Standard API response wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub status: Option<String>,
    pub code: Option<String>,
    pub message: Option<String>,
    pub data: Option<T>,
}

/// Error response from Harness API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub status: Option<String>,
    pub code: Option<String>,
    pub message: Option<String>,
    pub details: Option<serde_json::Value>,
}