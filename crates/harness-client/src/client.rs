use harness_config::Config;
use reqwest::{Client, RequestBuilder, Response};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;
use tracing::{debug, error};
use url::Url;

/// HTTP client for Harness APIs
/// Migrated from Go client patterns
#[derive(Debug, Clone)]
pub struct HarnessClient {
    client: Client,
    base_url: Url,
    config: Arc<Config>,
}

impl HarnessClient {
    /// Create a new Harness client
    pub fn new(config: Arc<Config>) -> Result<Self, Box<dyn std::error::Error>> {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()?;

        let base_url = Url::parse(&config.base_url)?;

        Ok(Self {
            client,
            base_url,
            config,
        })
    }

    /// Create a new client with custom timeout
    pub fn with_timeout(
        config: Arc<Config>,
        timeout: Duration,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let client = Client::builder()
            .timeout(timeout)
            .build()?;

        let base_url = Url::parse(&config.base_url)?;

        Ok(Self {
            client,
            base_url,
            config,
        })
    }

    /// Create a service-specific client
    pub fn for_service(
        config: Arc<Config>,
        service_base_url: &str,
        service_path: &str,
        timeout: Option<Duration>,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let client_builder = Client::builder();
        let client = if let Some(timeout) = timeout {
            client_builder.timeout(timeout).build()?
        } else {
            client_builder.timeout(Duration::from_secs(30)).build()?
        };

        let mut base_url = Url::parse(service_base_url)?;
        base_url = base_url.join(service_path)?;

        Ok(Self {
            client,
            base_url,
            config,
        })
    }

    /// Get the base URL
    pub fn base_url(&self) -> &Url {
        &self.base_url
    }

    /// Create a GET request
    pub fn get(&self, path: &str) -> RequestBuilder {
        let url = self.base_url.join(path).unwrap_or_else(|_| {
            // Fallback to base URL if join fails
            self.base_url.clone()
        });
        
        debug!("Creating GET request to: {}", url);
        let mut request = self.client.get(url);
        request = self.add_auth_headers(request);
        request
    }

    /// Create a POST request
    pub fn post(&self, path: &str) -> RequestBuilder {
        let url = self.base_url.join(path).unwrap_or_else(|_| {
            self.base_url.clone()
        });
        
        debug!("Creating POST request to: {}", url);
        let mut request = self.client.post(url);
        request = self.add_auth_headers(request);
        request
    }

    /// Create a PUT request
    pub fn put(&self, path: &str) -> RequestBuilder {
        let url = self.base_url.join(path).unwrap_or_else(|_| {
            self.base_url.clone()
        });
        
        debug!("Creating PUT request to: {}", url);
        let mut request = self.client.put(url);
        request = self.add_auth_headers(request);
        request
    }

    /// Create a DELETE request
    pub fn delete(&self, path: &str) -> RequestBuilder {
        let url = self.base_url.join(path).unwrap_or_else(|_| {
            self.base_url.clone()
        });
        
        debug!("Creating DELETE request to: {}", url);
        let mut request = self.client.delete(url);
        request = self.add_auth_headers(request);
        request
    }

    /// Add authentication headers to request
    fn add_auth_headers(&self, mut request: RequestBuilder) -> RequestBuilder {
        if let Some(api_key) = &self.config.api_key {
            request = request.header("x-api-key", api_key);
        }

        if let Some(bearer_token) = &self.config.bearer_token {
            request = request.header("Authorization", format!("Bearer {}", bearer_token));
        }

        // Add common headers
        request = request.header("Content-Type", "application/json");
        request = request.header("User-Agent", format!("harness-mcp-server/{}", self.config.version));

        request
    }

    /// Execute request and handle response
    pub async fn execute_request<T>(&self, request: RequestBuilder) -> Result<T, ClientError>
    where
        T: for<'de> Deserialize<'de>,
    {
        let response = request.send().await?;
        self.handle_response(response).await
    }

    /// Handle HTTP response
    async fn handle_response<T>(&self, response: Response) -> Result<T, ClientError>
    where
        T: for<'de> Deserialize<'de>,
    {
        let status = response.status();
        let url = response.url().clone();

        if status.is_success() {
            let text = response.text().await?;
            debug!("Successful response from {}: {}", url, text);
            
            serde_json::from_str(&text).map_err(|e| {
                error!("Failed to parse response from {}: {}", url, e);
                ClientError::ParseError(e.to_string())
            })
        } else {
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            error!("HTTP error {} from {}: {}", status, url, error_text);
            
            Err(ClientError::HttpError {
                status: status.as_u16(),
                message: error_text,
                url: url.to_string(),
            })
        }
    }
}

/// Client error types
#[derive(Debug, thiserror::Error)]
pub enum ClientError {
    #[error("HTTP request failed: {0}")]
    RequestError(#[from] reqwest::Error),

    #[error("HTTP error {status} from {url}: {message}")]
    HttpError {
        status: u16,
        message: String,
        url: String,
    },

    #[error("Failed to parse response: {0}")]
    ParseError(String),

    #[error("Configuration error: {0}")]
    ConfigError(String),
}

/// Standard Harness API response wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HarnessResponse<T> {
    pub status: String,
    pub data: Option<T>,
    pub error: Option<String>,
    pub message: Option<String>,
}

/// Pagination information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageInfo {
    pub page: Option<i32>,
    pub size: Option<i32>,
    pub total: Option<i64>,
    pub has_more: Option<bool>,
}

/// Paginated response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginatedResponse<T> {
    pub content: Vec<T>,
    pub page_info: Option<PageInfo>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use harness_config::Config;

    #[test]
    fn test_client_creation() {
        let mut config = Config::default();
        config.base_url = "https://app.harness.io".to_string();
        config.api_key = Some("test_key".to_string());

        let client = HarnessClient::new(Arc::new(config));
        assert!(client.is_ok());
    }

    #[test]
    fn test_service_client_creation() {
        let config = Config::default();
        let client = HarnessClient::for_service(
            Arc::new(config),
            "https://app.harness.io",
            "pipeline/api",
            Some(Duration::from_secs(60)),
        );
        assert!(client.is_ok());
    }
}