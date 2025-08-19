// HTTP client for Harness API interactions
// Replaces Go's HTTP client with Rust reqwest + retry middleware

use anyhow::Result;
use reqwest::{Client, RequestBuilder, Response};
use reqwest_middleware::{ClientBuilder, ClientWithMiddleware};
use reqwest_retry::{RetryTransientMiddleware, policies::ExponentialBackoff};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tracing::{debug, error, info};
use url::Url;

use crate::config::Config;
use crate::harness::errors::{HarnessError, HarnessResult};

#[derive(Debug, Clone)]
pub struct HarnessClient {
    client: ClientWithMiddleware,
    base_url: Url,
    api_key: String,
    account_id: String,
    default_org_id: Option<String>,
    default_project_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestOptions {
    pub org_id: Option<String>,
    pub project_id: Option<String>,
    pub timeout: Option<Duration>,
    pub headers: Option<std::collections::HashMap<String, String>>,
}

impl Default for RequestOptions {
    fn default() -> Self {
        Self {
            org_id: None,
            project_id: None,
            timeout: Some(Duration::from_secs(30)),
            headers: None,
        }
    }
}

impl HarnessClient {
    pub fn new(config: &Config) -> Result<Self> {
        let base_url = Url::parse(&config.base_url)
            .map_err(|e| HarnessError::configuration("base_url", e.to_string()))?;
        
        // Create retry policy
        let retry_policy = ExponentialBackoff::builder()
            .retry_bounds(Duration::from_millis(100), Duration::from_secs(10))
            .build_with_max_retries(3);
        
        // Build client with retry middleware
        let client = ClientBuilder::new(
            Client::builder()
                .timeout(Duration::from_secs(60))
                .user_agent(format!("harness-mcp-server/{}", config.version))
                .build()
                .map_err(|e| HarnessError::network(e.to_string()))?
        )
        .with(RetryTransientMiddleware::new_with_policy(retry_policy))
        .build();
        
        Ok(Self {
            client,
            base_url,
            api_key: config.api_key.clone(),
            account_id: config.account_id.clone(),
            default_org_id: config.default_org_id.clone(),
            default_project_id: config.default_project_id.clone(),
        })
    }
    
    pub async fn get<T>(&self, path: &str, options: Option<RequestOptions>) -> HarnessResult<T>
    where
        T: for<'de> Deserialize<'de>,
    {
        let request = self.build_request("GET", path, options)?;
        self.execute_request(request).await
    }
    
    pub async fn post<T, B>(&self, path: &str, body: &B, options: Option<RequestOptions>) -> HarnessResult<T>
    where
        T: for<'de> Deserialize<'de>,
        B: Serialize,
    {
        let mut request = self.build_request("POST", path, options)?;
        request = request.json(body);
        self.execute_request(request).await
    }
    
    pub async fn put<T, B>(&self, path: &str, body: &B, options: Option<RequestOptions>) -> HarnessResult<T>
    where
        T: for<'de> Deserialize<'de>,
        B: Serialize,
    {
        let mut request = self.build_request("PUT", path, options)?;
        request = request.json(body);
        self.execute_request(request).await
    }
    
    pub async fn delete<T>(&self, path: &str, options: Option<RequestOptions>) -> HarnessResult<T>
    where
        T: for<'de> Deserialize<'de>,
    {
        let request = self.build_request("DELETE", path, options)?;
        self.execute_request(request).await
    }
    
    fn build_request(&self, method: &str, path: &str, options: Option<RequestOptions>) -> HarnessResult<RequestBuilder> {
        let options = options.unwrap_or_default();
        
        // Build URL
        let mut url = self.base_url.join(path)
            .map_err(|e| HarnessError::configuration("url", e.to_string()))?;
        
        // Add query parameters for scope
        {
            let mut query_pairs = url.query_pairs_mut();
            query_pairs.append_pair("accountIdentifier", &self.account_id);
            
            if let Some(org_id) = options.org_id.as_ref().or(self.default_org_id.as_ref()) {
                query_pairs.append_pair("orgIdentifier", org_id);
            }
            
            if let Some(project_id) = options.project_id.as_ref().or(self.default_project_id.as_ref()) {
                query_pairs.append_pair("projectIdentifier", project_id);
            }
        }
        
        debug!("Building {} request to: {}", method, url);
        
        // Create request builder
        let mut request = match method {
            "GET" => self.client.get(url),
            "POST" => self.client.post(url),
            "PUT" => self.client.put(url),
            "DELETE" => self.client.delete(url),
            _ => return Err(HarnessError::validation(format!("Unsupported HTTP method: {}", method))),
        };
        
        // Add authentication header
        request = request.header("x-api-key", &self.api_key);
        
        // Add content type for POST/PUT requests
        if matches!(method, "POST" | "PUT") {
            request = request.header("Content-Type", "application/json");
        }
        
        // Add custom headers
        if let Some(headers) = options.headers {
            for (key, value) in headers {
                request = request.header(key, value);
            }
        }
        
        // Set timeout
        if let Some(timeout) = options.timeout {
            request = request.timeout(timeout);
        }
        
        Ok(request)
    }
    
    async fn execute_request<T>(&self, request: RequestBuilder) -> HarnessResult<T>
    where
        T: for<'de> Deserialize<'de>,
    {
        let response = request.send().await?;
        
        debug!("Response status: {}", response.status());
        
        if response.status().is_success() {
            let text = response.text().await?;
            debug!("Response body: {}", text);
            
            serde_json::from_str(&text)
                .map_err(|e| HarnessError::serialization(format!("Failed to parse response: {}", e)))
        } else {
            let status = response.status();
            let text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            
            error!("API request failed with status {}: {}", status, text);
            
            // Try to parse as API error response
            if let Ok(api_error) = serde_json::from_str::<crate::harness::errors::ApiErrorResponse>(&text) {
                Err(HarnessError::api_error(status.as_u16(), api_error.message))
            } else {
                Err(HarnessError::api_error(status.as_u16(), text))
            }
        }
    }
    
    pub fn account_id(&self) -> &str {
        &self.account_id
    }
    
    pub fn default_org_id(&self) -> Option<&str> {
        self.default_org_id.as_deref()
    }
    
    pub fn default_project_id(&self) -> Option<&str> {
        self.default_project_id.as_deref()
    }
}

// Specialized clients for different Harness services
#[derive(Debug, Clone)]
pub struct PipelineClient {
    client: HarnessClient,
}

impl PipelineClient {
    pub fn new(config: &Config) -> Result<Self> {
        Ok(Self {
            client: HarnessClient::new(config)?,
        })
    }
    
    pub async fn get_pipeline(&self, pipeline_id: &str, options: Option<RequestOptions>) -> HarnessResult<crate::harness::dto::Pipeline> {
        let path = format!("/pipeline/api/pipelines/{}", pipeline_id);
        self.client.get(&path, options).await
    }
    
    pub async fn list_pipelines(&self, options: Option<RequestOptions>) -> HarnessResult<Vec<crate::harness::dto::Pipeline>> {
        let path = "/pipeline/api/pipelines";
        self.client.get(path, options).await
    }
}

#[derive(Debug, Clone)]
pub struct ConnectorClient {
    client: HarnessClient,
}

impl ConnectorClient {
    pub fn new(config: &Config) -> Result<Self> {
        Ok(Self {
            client: HarnessClient::new(config)?,
        })
    }
    
    pub async fn get_connector(&self, connector_id: &str, options: Option<RequestOptions>) -> HarnessResult<crate::harness::dto::ConnectorDetail> {
        let path = format!("/ng/api/connectors/{}", connector_id);
        self.client.get(&path, options).await
    }
    
    pub async fn list_connectors(&self, options: Option<RequestOptions>) -> HarnessResult<Vec<crate::harness::dto::ConnectorDetail>> {
        let path = "/ng/api/connectors";
        self.client.get(path, options).await
    }
}