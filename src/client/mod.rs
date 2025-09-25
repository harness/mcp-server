use crate::config::Config;
use crate::error::{HarnessError, Result};
use reqwest::{Client, RequestBuilder};
use serde::de::DeserializeOwned;
use serde_json::Value;
use std::time::Duration;
use tracing::{debug, error};
use url::Url;

/// HTTP client for Harness APIs
#[derive(Clone)]
pub struct HarnessClient {
    client: Client,
    base_url: Url,
    api_key: String,
    account_id: String,
}

impl HarnessClient {
    pub fn new(config: &Config) -> Result<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent(format!("harness-mcp-client/{}", config.version))
            .build()?;
        
        let base_url = Url::parse(&config.base_url)?;
        
        Ok(Self {
            client,
            base_url,
            api_key: config.api_key.clone(),
            account_id: config.account_id.clone(),
        })
    }
    
    /// Make a GET request
    pub async fn get<T>(&self, path: &str, params: Option<&[(&str, &str)]>) -> Result<T>
    where
        T: DeserializeOwned,
    {
        let url = self.base_url.join(path)?;
        let mut request = self.client.get(url);
        
        if let Some(params) = params {
            request = request.query(params);
        }
        
        self.execute_request(request).await
    }
    
    /// Make a POST request
    pub async fn post<T>(&self, path: &str, body: &Value) -> Result<T>
    where
        T: DeserializeOwned,
    {
        let url = self.base_url.join(path)?;
        let request = self.client.post(url).json(body);
        
        self.execute_request(request).await
    }
    
    /// Make a PUT request
    pub async fn put<T>(&self, path: &str, body: &Value) -> Result<T>
    where
        T: DeserializeOwned,
    {
        let url = self.base_url.join(path)?;
        let request = self.client.put(url).json(body);
        
        self.execute_request(request).await
    }
    
    /// Make a DELETE request
    pub async fn delete<T>(&self, path: &str) -> Result<T>
    where
        T: DeserializeOwned,
    {
        let url = self.base_url.join(path)?;
        let request = self.client.delete(url);
        
        self.execute_request(request).await
    }
    
    /// Execute a request with common headers and error handling
    async fn execute_request<T>(&self, request: RequestBuilder) -> Result<T>
    where
        T: DeserializeOwned,
    {
        let request = request
            .header("x-api-key", &self.api_key)
            .header("Harness-Account", &self.account_id)
            .header("Content-Type", "application/json");
        
        debug!("Making HTTP request");
        
        let response = request.send().await?;
        let status = response.status();
        
        if status.is_success() {
            let text = response.text().await?;
            debug!("Response: {}", text);
            
            serde_json::from_str(&text).map_err(|e| {
                error!("Failed to parse response: {}", e);
                HarnessError::Json(e)
            })
        } else {
            let text = response.text().await.unwrap_or_default();
            error!("HTTP error {}: {}", status, text);
            
            match status.as_u16() {
                400 => Err(HarnessError::bad_request(text)),
                401 => Err(HarnessError::auth(text)),
                404 => Err(HarnessError::not_found(text)),
                429 => Err(HarnessError::RateLimitExceeded),
                500..=599 => Err(HarnessError::internal(text)),
                _ => Err(HarnessError::internal(format!("HTTP {}: {}", status, text))),
            }
        }
    }
}