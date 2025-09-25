//! HTTP client implementation for Harness APIs

use crate::error::{Error, Result};
use harness_mcp_auth::AuthProvider;
use reqwest::{Client as HttpClient, RequestBuilder};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;
use url::Url;

/// HTTP client for Harness APIs
#[derive(Clone)]
pub struct Client {
    http_client: HttpClient,
    base_url: Url,
    auth_provider: Arc<dyn AuthProvider>,
}

impl Client {
    /// Create a new client with the specified configuration
    pub fn new(
        base_url: Url,
        auth_provider: Arc<dyn AuthProvider>,
        timeout: Option<Duration>,
    ) -> Result<Self> {
        let timeout = timeout.unwrap_or(Duration::from_secs(30));
        
        let http_client = HttpClient::builder()
            .timeout(timeout)
            .build()?;

        Ok(Self {
            http_client,
            base_url,
            auth_provider,
        })
    }

    /// Make a GET request
    pub async fn get<T>(&self, path: &str) -> Result<T>
    where
        T: for<'de> Deserialize<'de>,
    {
        let url = self.base_url.join(path)?;
        let request = self.http_client.get(url);
        self.execute_request(request).await
    }

    /// Make a POST request
    pub async fn post<B, T>(&self, path: &str, body: &B) -> Result<T>
    where
        B: Serialize,
        T: for<'de> Deserialize<'de>,
    {
        let url = self.base_url.join(path)?;
        let request = self.http_client.post(url).json(body);
        self.execute_request(request).await
    }

    /// Execute a request with authentication
    async fn execute_request<T>(&self, mut request: RequestBuilder) -> Result<T>
    where
        T: for<'de> Deserialize<'de>,
    {
        // Add authentication headers
        let mut headers = reqwest::header::HeaderMap::new();
        self.auth_provider.add_auth_headers(&mut headers).await
            .map_err(|e| Error::Authentication(e.to_string()))?;
        
        for (key, value) in headers.iter() {
            request = request.header(key, value);
        }
        
        let response = request.send().await?;
        
        if response.status().is_success() {
            let result = response.json().await?;
            Ok(result)
        } else {
            Err(Error::Api {
                status: response.status().as_u16(),
                message: response.text().await.unwrap_or_default(),
            })
        }
    }
}