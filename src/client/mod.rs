// Harness API client implementation
// This replaces the Go SDK functionality

use anyhow::Result;
use reqwest::{Client, RequestBuilder, Response};
use serde_json::Value;
use std::time::Duration;
use tracing::{debug, error};
// use backoff::{ExponentialBackoff, future::retry};

use crate::types::{HarnessError, Scope, ApiResponse};

/// Main Harness API client
pub struct HarnessClient {
    client: Client,
    base_url: String,
    api_key: Option<String>,
    bearer_token: Option<String>,
    default_timeout: Duration,
}

impl HarnessClient {
    /// Create a new Harness client with base URL
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
            default_timeout: Duration::from_secs(30),
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

    /// Set custom timeout
    pub fn with_timeout(mut self, timeout: Duration) -> Self {
        self.default_timeout = timeout;
        self
    }

    /// Perform GET request
    pub async fn get(&self, path: &str) -> Result<Value> {
        let url = format!("{}{}", self.base_url, path);
        debug!("GET request to: {}", url);

        let request = self.client.get(&url);
        let response = self.execute_with_retry(request).await?;
        self.parse_response(response).await
    }

    /// Perform GET request with scope
    pub async fn get_with_scope(&self, path: &str, scope: &Scope) -> Result<Value> {
        let url = self.build_url_with_scope(path, scope);
        debug!("GET request with scope to: {}", url);

        let request = self.client.get(&url);
        let response = self.execute_with_retry(request).await?;
        self.parse_response(response).await
    }

    /// Perform POST request
    pub async fn post(&self, path: &str, body: Value) -> Result<Value> {
        let url = format!("{}{}", self.base_url, path);
        debug!("POST request to: {}", url);

        let request = self.client
            .post(&url)
            .json(&body);
        
        let response = self.execute_with_retry(request).await?;
        self.parse_response(response).await
    }

    /// Perform POST request with scope
    pub async fn post_with_scope(&self, path: &str, scope: &Scope, body: Value) -> Result<Value> {
        let url = self.build_url_with_scope(path, scope);
        debug!("POST request with scope to: {}", url);

        let request = self.client
            .post(&url)
            .json(&body);
        
        let response = self.execute_with_retry(request).await?;
        self.parse_response(response).await
    }

    /// Perform PUT request
    pub async fn put(&self, path: &str, body: Value) -> Result<Value> {
        let url = format!("{}{}", self.base_url, path);
        debug!("PUT request to: {}", url);

        let request = self.client
            .put(&url)
            .json(&body);
        
        let response = self.execute_with_retry(request).await?;
        self.parse_response(response).await
    }

    /// Perform DELETE request
    pub async fn delete(&self, path: &str) -> Result<Value> {
        let url = format!("{}{}", self.base_url, path);
        debug!("DELETE request to: {}", url);

        let request = self.client.delete(&url);
        let response = self.execute_with_retry(request).await?;
        self.parse_response(response).await
    }

    /// Build URL with scope parameters
    fn build_url_with_scope(&self, path: &str, scope: &Scope) -> String {
        let mut url = format!("{}{}", self.base_url, path);
        
        // Add account ID
        let separator = if url.contains('?') { "&" } else { "?" };
        url.push_str(&format!("{}accountIdentifier={}", separator, scope.account_id));
        
        // Add org ID if present
        if let Some(org_id) = &scope.org_id {
            url.push_str(&format!("&orgIdentifier={}", org_id));
        }
        
        // Add project ID if present
        if let Some(project_id) = &scope.project_id {
            url.push_str(&format!("&projectIdentifier={}", project_id));
        }
        
        url
    }

    /// Add authentication headers to request
    fn add_auth_headers(&self, mut request: RequestBuilder) -> RequestBuilder {
        if let Some(api_key) = &self.api_key {
            request = request.header("x-api-key", api_key);
        }
        
        if let Some(bearer_token) = &self.bearer_token {
            request = request.header("Authorization", format!("Bearer {}", bearer_token));
        }
        
        // Add common headers
        request = request
            .header("Content-Type", "application/json")
            .header("Accept", "application/json")
            .header("User-Agent", format!("harness-mcp-server-rust/{}", env!("CARGO_PKG_VERSION")));
        
        request
    }

    /// Execute request with authentication
    async fn execute_with_retry(&self, request: RequestBuilder) -> Result<Response> {
        let request = self.add_auth_headers(request);
        
        // For now, just execute without retry - we can add retry logic later
        let response = request.send().await?;
        Ok(response)
    }

    /// Parse response and handle errors
    async fn parse_response(&self, response: Response) -> Result<Value> {
        let status = response.status();
        let headers = response.headers().clone();
        
        // Get correlation ID from headers if present
        let correlation_id = headers
            .get("x-correlation-id")
            .or_else(|| headers.get("x-request-id"))
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string());

        let body = response.text().await?;
        
        if !status.is_success() {
            error!("API error: {} - {}", status, body);
            return Err(crate::types::api_error_from_response(
                status.as_u16(),
                &body,
                correlation_id,
            ).into());
        }

        // Try to parse as Harness API response format
        if let Ok(api_response) = serde_json::from_str::<ApiResponse<Value>>(&body) {
            if api_response.status == "SUCCESS" {
                return Ok(api_response.data.unwrap_or(Value::Null));
            } else {
                // Handle API-level errors
                let message = api_response.message.unwrap_or_else(|| "Unknown API error".to_string());
                return Err(HarnessError::Api {
                    message,
                    code: api_response.code,
                    correlation_id: api_response.correlation_id,
                }.into());
            }
        }

        // If not a standard API response, try to parse as raw JSON
        match serde_json::from_str::<Value>(&body) {
            Ok(json) => Ok(json),
            Err(_) => {
                // If not JSON, return as string value
                Ok(Value::String(body))
            }
        }
    }
}

/// Specialized clients for different Harness services
pub struct PipelineClient {
    client: HarnessClient,
}

impl PipelineClient {
    pub fn new(client: HarnessClient) -> Self {
        Self { client }
    }

    /// Get pipeline details
    pub async fn get_pipeline(&self, scope: &Scope, pipeline_id: &str) -> Result<Value> {
        let path = format!("/pipeline/api/pipelines/{}", pipeline_id);
        self.client.get_with_scope(&path, scope).await
    }

    /// List pipelines
    pub async fn list_pipelines(&self, scope: &Scope, page: Option<i32>, limit: Option<i32>) -> Result<Value> {
        let mut path = "/pipeline/api/pipelines".to_string();
        
        if let Some(page) = page {
            path.push_str(&format!("&page={}", page));
        }
        if let Some(limit) = limit {
            path.push_str(&format!("&size={}", limit));
        }
        
        self.client.get_with_scope(&path, scope).await
    }

    /// Get pipeline execution
    pub async fn get_execution(&self, scope: &Scope, execution_id: &str) -> Result<Value> {
        let path = format!("/pipeline/api/pipelines/execution/{}", execution_id);
        self.client.get_with_scope(&path, scope).await
    }

    /// List pipeline executions
    pub async fn list_executions(&self, scope: &Scope, pipeline_id: &str, page: Option<i32>, limit: Option<i32>) -> Result<Value> {
        let mut path = format!("/pipeline/api/pipelines/{}/executions", pipeline_id);
        
        if let Some(page) = page {
            path.push_str(&format!("&page={}", page));
        }
        if let Some(limit) = limit {
            path.push_str(&format!("&size={}", limit));
        }
        
        self.client.get_with_scope(&path, scope).await
    }
}

/// Connector client
pub struct ConnectorClient {
    client: HarnessClient,
}

impl ConnectorClient {
    pub fn new(client: HarnessClient) -> Self {
        Self { client }
    }

    /// List connectors
    pub async fn list_connectors(&self, scope: &Scope, page: Option<i32>, limit: Option<i32>) -> Result<Value> {
        let mut path = "/ng/api/connectors".to_string();
        
        if let Some(page) = page {
            path.push_str(&format!("&page={}", page));
        }
        if let Some(limit) = limit {
            path.push_str(&format!("&size={}", limit));
        }
        
        self.client.get_with_scope(&path, scope).await
    }

    /// Get connector details
    pub async fn get_connector(&self, scope: &Scope, connector_id: &str) -> Result<Value> {
        let path = format!("/ng/api/connectors/{}", connector_id);
        self.client.get_with_scope(&path, scope).await
    }

    /// Get connector catalogue
    pub async fn get_connector_catalogue(&self, scope: &Scope) -> Result<Value> {
        let path = "/ng/api/connectors/catalogue";
        self.client.get_with_scope(&path, scope).await
    }
}

/// Repository client
pub struct RepositoryClient {
    client: HarnessClient,
}

impl RepositoryClient {
    pub fn new(client: HarnessClient) -> Self {
        Self { client }
    }

    /// List repositories
    pub async fn list_repositories(&self, scope: &Scope, page: Option<i32>, limit: Option<i32>) -> Result<Value> {
        let mut path = "/code/api/v1/repos".to_string();
        
        if let Some(page) = page {
            path.push_str(&format!("&page={}", page));
        }
        if let Some(limit) = limit {
            path.push_str(&format!("&limit={}", limit));
        }
        
        self.client.get_with_scope(&path, scope).await
    }

    /// Get repository details
    pub async fn get_repository(&self, scope: &Scope, repo_id: &str) -> Result<Value> {
        let path = format!("/code/api/v1/repos/{}", repo_id);
        self.client.get_with_scope(&path, scope).await
    }

    /// List pull requests
    pub async fn list_pull_requests(&self, scope: &Scope, repo_id: &str, state: Option<&str>) -> Result<Value> {
        let mut path = format!("/code/api/v1/repos/{}/pullreq", repo_id);
        
        if let Some(state) = state {
            path.push_str(&format!("&state={}", state));
        }
        
        self.client.get_with_scope(&path, scope).await
    }

    /// Get pull request details
    pub async fn get_pull_request(&self, scope: &Scope, repo_id: &str, pr_number: i32) -> Result<Value> {
        let path = format!("/code/api/v1/repos/{}/pullreq/{}", repo_id, pr_number);
        self.client.get_with_scope(&path, scope).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_client_creation() {
        let client = HarnessClient::new("https://app.harness.io".to_string())
            .with_api_key("test-key".to_string())
            .with_timeout(Duration::from_secs(60));
        
        assert_eq!(client.base_url, "https://app.harness.io");
        assert_eq!(client.api_key, Some("test-key".to_string()));
        assert_eq!(client.default_timeout, Duration::from_secs(60));
    }

    #[test]
    fn test_url_building_with_scope() {
        let client = HarnessClient::new("https://app.harness.io".to_string());
        let scope = Scope::new("account123".to_string())
            .with_org("org456".to_string())
            .with_project("project789".to_string());
        
        let url = client.build_url_with_scope("/api/test", &scope);
        assert!(url.contains("accountIdentifier=account123"));
        assert!(url.contains("orgIdentifier=org456"));
        assert!(url.contains("projectIdentifier=project789"));
    }
}