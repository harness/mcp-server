use crate::{Error, Result};
use backoff::{future::retry, ExponentialBackoff};
use harness_mcp_auth::AuthProvider;
use harness_mcp_config::Config;
use reqwest::{Client, RequestBuilder, Response};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tracing::{debug, error, info, warn};

#[derive(Clone)]
pub struct HarnessClient {
    client: Client,
    base_url: String,
    auth_provider: AuthProvider,
}

impl HarnessClient {
    pub fn new(config: &Config, auth_provider: AuthProvider) -> Result<Self> {
        info!(
            "Creating Harness client with base URL: {}",
            config.get_base_url()
        );

        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent(format!("harness-mcp-rust/{}", env!("CARGO_PKG_VERSION")))
            .build()
            .map_err(Error::Http)?;

        Ok(Self {
            client,
            base_url: config.get_base_url().to_string(),
            auth_provider,
        })
    }

    pub async fn get<T>(&self, path: &str) -> Result<T>
    where
        T: for<'de> Deserialize<'de>,
    {
        self.execute_with_retry(|| async {
            let url = format!("{}{}", self.base_url, path);
            debug!("GET {}", url);

            let request = self.client.get(&url);
            let response = self.execute_request(request).await?;
            self.parse_response(response).await
        })
        .await
    }

    pub async fn post<B, T>(&self, path: &str, body: &B) -> Result<T>
    where
        B: Serialize,
        T: for<'de> Deserialize<'de>,
    {
        let body_json = serde_json::to_value(body).map_err(Error::Serialization)?;

        self.execute_with_retry(|| async {
            let url = format!("{}{}", self.base_url, path);
            debug!("POST {}", url);

            let request = self.client.post(&url).json(&body_json);
            let response = self.execute_request(request).await?;
            self.parse_response(response).await
        })
        .await
    }

    pub async fn put<B, T>(&self, path: &str, body: &B) -> Result<T>
    where
        B: Serialize,
        T: for<'de> Deserialize<'de>,
    {
        let url = format!("{}{}", self.base_url, path);
        debug!("PUT {}", url);

        let request = self.client.put(&url).json(body);
        let response = self.execute_request(request).await?;
        self.parse_response(response).await
    }

    pub async fn delete<T>(&self, path: &str) -> Result<T>
    where
        T: for<'de> Deserialize<'de>,
    {
        let url = format!("{}{}", self.base_url, path);
        debug!("DELETE {}", url);

        let request = self.client.delete(&url);
        let response = self.execute_request(request).await?;
        self.parse_response(response).await
    }

    async fn execute_request(&self, mut request: RequestBuilder) -> Result<Response> {
        // Add authentication headers
        request = self
            .auth_provider
            .add_auth_headers(request)
            .await
            .map_err(Error::Auth)?;

        debug!("Executing HTTP request");

        let response = request.send().await.map_err(|e| {
            if e.is_timeout() {
                warn!("Request timed out: {}", e);
                Error::Timeout(e.to_string())
            } else if e.is_connect() {
                warn!("Connection failed: {}", e);
                Error::Network(format!("Connection failed: {}", e))
            } else {
                error!("HTTP request failed: {}", e);
                Error::Http(e)
            }
        })?;

        if response.status().is_success() {
            debug!("Request successful with status: {}", response.status());
            Ok(response)
        } else {
            let status = response.status();
            let text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            error!("HTTP error {}: {}", status, text);

            Err(Error::from_status_code(status, text))
        }
    }

    async fn parse_response<T>(&self, response: Response) -> Result<T>
    where
        T: for<'de> Deserialize<'de>,
    {
        let text = response
            .text()
            .await
            .map_err(|e| Error::Network(format!("Failed to read response body: {}", e)))?;

        if text.is_empty() {
            return Err(Error::InvalidResponse("Empty response body".to_string()));
        }

        serde_json::from_str(&text).map_err(|e| {
            Error::InvalidResponse(format!("Failed to parse JSON: {} - Response: {}", e, text))
        })
    }

    // Service-specific client methods
    pub fn pipelines(&self) -> crate::services::PipelineService {
        crate::services::PipelineService::new(self.clone())
    }

    pub fn connectors(&self) -> crate::services::ConnectorService {
        crate::services::ConnectorService::new(self.clone())
    }

    pub fn environments(&self) -> crate::services::EnvironmentService {
        crate::services::EnvironmentService::new(self.clone())
    }

    async fn execute_with_retry<F, Fut, T>(&self, operation: F) -> Result<T>
    where
        F: Fn() -> Fut,
        Fut: std::future::Future<Output = Result<T>>,
    {
        let backoff = ExponentialBackoff {
            max_elapsed_time: Some(Duration::from_secs(60)),
            max_interval: Duration::from_secs(10),
            ..Default::default()
        };

        retry(backoff, || async {
            match operation().await {
                Ok(result) => Ok(result),
                Err(e) if e.is_retryable() => {
                    warn!("Retryable error occurred: {}", e);
                    Err(backoff::Error::transient(e))
                }
                Err(e) => {
                    error!("Non-retryable error occurred: {}", e);
                    Err(backoff::Error::permanent(e))
                }
            }
        })
        .await
    }
}
