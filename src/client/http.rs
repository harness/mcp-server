use crate::error::{Result, McpError};
use reqwest::{Client, RequestBuilder};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tracing::{debug, error};

#[derive(Clone)]
pub struct HttpClient {
    client: Client,
    base_url: String,
    api_key: Option<String>,
    timeout: Duration,
}

impl HttpClient {
    pub fn new(base_url: String) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client,
            base_url,
            api_key: None,
            timeout: Duration::from_secs(30),
        }
    }

    pub fn with_api_key(mut self, api_key: String) -> Self {
        self.api_key = Some(api_key);
        self
    }

    pub fn with_timeout(mut self, timeout: Duration) -> Self {
        self.timeout = timeout;
        self
    }

    pub async fn get<T>(&self, path: &str) -> Result<T>
    where
        T: for<'de> Deserialize<'de>,
    {
        let url = format!("{}/{}", self.base_url.trim_end_matches('/'), path.trim_start_matches('/'));
        debug!("GET {}", url);

        let mut request = self.client.get(&url);
        request = self.add_auth_headers(request);

        let response = request.send().await?;
        self.handle_response(response).await
    }

    pub async fn post<T, B>(&self, path: &str, body: &B) -> Result<T>
    where
        T: for<'de> Deserialize<'de>,
        B: Serialize,
    {
        let url = format!("{}/{}", self.base_url.trim_end_matches('/'), path.trim_start_matches('/'));
        debug!("POST {}", url);

        let mut request = self.client.post(&url).json(body);
        request = self.add_auth_headers(request);

        let response = request.send().await?;
        self.handle_response(response).await
    }

    pub async fn put<T, B>(&self, path: &str, body: &B) -> Result<T>
    where
        T: for<'de> Deserialize<'de>,
        B: Serialize,
    {
        let url = format!("{}/{}", self.base_url.trim_end_matches('/'), path.trim_start_matches('/'));
        debug!("PUT {}", url);

        let mut request = self.client.put(&url).json(body);
        request = self.add_auth_headers(request);

        let response = request.send().await?;
        self.handle_response(response).await
    }

    pub async fn delete<T>(&self, path: &str) -> Result<T>
    where
        T: for<'de> Deserialize<'de>,
    {
        let url = format!("{}/{}", self.base_url.trim_end_matches('/'), path.trim_start_matches('/'));
        debug!("DELETE {}", url);

        let mut request = self.client.delete(&url);
        request = self.add_auth_headers(request);

        let response = request.send().await?;
        self.handle_response(response).await
    }

    fn add_auth_headers(&self, request: RequestBuilder) -> RequestBuilder {
        let mut request = request.header("Content-Type", "application/json");
        
        if let Some(api_key) = &self.api_key {
            request = request.header("x-api-key", api_key);
        }

        request
    }

    async fn handle_response<T>(&self, response: reqwest::Response) -> Result<T>
    where
        T: for<'de> Deserialize<'de>,
    {
        let status = response.status();
        
        if status.is_success() {
            let text = response.text().await?;
            debug!("Response: {}", text);
            
            serde_json::from_str(&text)
                .map_err(|e| {
                    error!("Failed to deserialize response: {}", e);
                    McpError::Json(e)
                })
        } else {
            let text = response.text().await.unwrap_or_default();
            error!("HTTP error {}: {}", status, text);
            
            match status.as_u16() {
                401 => Err(McpError::auth("Unauthorized")),
                403 => Err(McpError::auth("Forbidden")),
                404 => Err(McpError::validation("Resource not found")),
                429 => Err(McpError::rate_limit("API")),
                500..=599 => Err(McpError::service_unavailable("API")),
                _ => Err(McpError::internal(format!("HTTP {}: {}", status, text))),
            }
        }
    }
}