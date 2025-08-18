//! HTTP client module for Harness API interactions

use crate::{auth::Provider, Error, Result};
use reqwest::{Client, RequestBuilder, Response};
use serde::de::DeserializeOwned;
use std::sync::Arc;
use std::time::Duration;

/// HTTP client for Harness API
pub struct HarnessClient {
    client: Client,
    base_url: String,
    auth_provider: Arc<dyn Provider>,
}

impl HarnessClient {
    /// Create a new Harness client
    pub fn new(
        base_url: String,
        auth_provider: Arc<dyn Provider>,
        timeout: Option<Duration>,
    ) -> Result<Self> {
        let client = Client::builder()
            .timeout(timeout.unwrap_or(Duration::from_secs(30)))
            .build()
            .map_err(Error::from)?;

        Ok(Self {
            client,
            base_url,
            auth_provider,
        })
    }

    /// Make a GET request
    pub async fn get<T>(&self, path: &str) -> Result<T>
    where
        T: DeserializeOwned,
    {
        let url = format!("{}/{}", self.base_url.trim_end_matches('/'), path.trim_start_matches('/'));
        let request = self.client.get(&url);
        self.execute_request(request).await
    }

    /// Make a POST request
    pub async fn post<T, B>(&self, path: &str, body: &B) -> Result<T>
    where
        T: DeserializeOwned,
        B: serde::Serialize,
    {
        let url = format!("{}/{}", self.base_url.trim_end_matches('/'), path.trim_start_matches('/'));
        let request = self.client.post(&url).json(body);
        self.execute_request(request).await
    }

    /// Make a PUT request
    pub async fn put<T, B>(&self, path: &str, body: &B) -> Result<T>
    where
        T: DeserializeOwned,
        B: serde::Serialize,
    {
        let url = format!("{}/{}", self.base_url.trim_end_matches('/'), path.trim_start_matches('/'));
        let request = self.client.put(&url).json(body);
        self.execute_request(request).await
    }

    /// Make a DELETE request
    pub async fn delete<T>(&self, path: &str) -> Result<T>
    where
        T: DeserializeOwned,
    {
        let url = format!("{}/{}", self.base_url.trim_end_matches('/'), path.trim_start_matches('/'));
        let request = self.client.delete(&url);
        self.execute_request(request).await
    }

    /// Execute a request with authentication
    async fn execute_request<T>(&self, mut request: RequestBuilder) -> Result<T>
    where
        T: DeserializeOwned,
    {
        // Add authentication header
        let (header_name, header_value) = self.auth_provider.get_header().await?;
        request = request.header(header_name, header_value);

        // Execute request
        let response = request.send().await.map_err(Error::from)?;
        self.handle_response(response).await
    }

    /// Handle HTTP response
    async fn handle_response<T>(&self, response: Response) -> Result<T>
    where
        T: DeserializeOwned,
    {
        let status = response.status();
        
        if status.is_success() {
            response.json().await.map_err(Error::from)
        } else {
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            Err(Error::api(status.as_u16(), error_text))
        }
    }
}