use crate::dto::*;
use anyhow::{anyhow, Result};
use harness_mcp_auth::AuthProvider;
use reqwest::{Client as HttpClient, Method, RequestBuilder, Response, StatusCode};
use serde::de::DeserializeOwned;
use serde::Serialize;
use std::collections::HashMap;
use std::time::Duration;
use tracing::{debug, error, warn};
use url::Url;

/// HTTP client for Harness APIs
#[derive(Clone)]
pub struct Client {
    http_client: HttpClient,
    base_url: Url,
    auth_provider: Box<dyn AuthProvider>,
    user_agent: String,
}

/// Client builder for configuring the HTTP client
pub struct ClientBuilder {
    base_url: Option<Url>,
    auth_provider: Option<Box<dyn AuthProvider>>,
    timeout: Option<Duration>,
    user_agent: Option<String>,
}

impl ClientBuilder {
    /// Create a new client builder
    pub fn new() -> Self {
        Self {
            base_url: None,
            auth_provider: None,
            timeout: Some(Duration::from_secs(30)),
            user_agent: None,
        }
    }

    /// Set the base URL
    pub fn base_url(mut self, url: Url) -> Self {
        self.base_url = Some(url);
        self
    }

    /// Set the authentication provider
    pub fn auth_provider(mut self, provider: Box<dyn AuthProvider>) -> Self {
        self.auth_provider = Some(provider);
        self
    }

    /// Set the request timeout
    pub fn timeout(mut self, timeout: Duration) -> Self {
        self.timeout = Some(timeout);
        self
    }

    /// Set the user agent
    pub fn user_agent<S: Into<String>>(mut self, user_agent: S) -> Self {
        self.user_agent = Some(user_agent.into());
        self
    }

    /// Build the client
    pub fn build(self) -> Result<Client> {
        let base_url = self.base_url.ok_or_else(|| anyhow!("Base URL is required"))?;
        let auth_provider = self.auth_provider.ok_or_else(|| anyhow!("Auth provider is required"))?;
        
        let mut http_client_builder = HttpClient::builder();
        
        if let Some(timeout) = self.timeout {
            http_client_builder = http_client_builder.timeout(timeout);
        }

        let http_client = http_client_builder.build()?;
        
        let user_agent = self.user_agent.unwrap_or_else(|| {
            format!("harness-mcp-client/{}", env!("CARGO_PKG_VERSION"))
        });

        Ok(Client {
            http_client,
            base_url,
            auth_provider,
            user_agent,
        })
    }
}

impl Default for ClientBuilder {
    fn default() -> Self {
        Self::new()
    }
}

impl Client {
    /// Create a new client builder
    pub fn builder() -> ClientBuilder {
        ClientBuilder::new()
    }

    /// Make a GET request
    pub async fn get<T>(&self, path: &str, params: Option<HashMap<String, String>>) -> Result<T>
    where
        T: DeserializeOwned,
    {
        let url = self.build_url(path)?;
        let mut request = self.http_client.get(url);
        
        if let Some(params) = params {
            request = request.query(&params);
        }

        self.execute_request(request).await
    }

    /// Make a POST request
    pub async fn post<B, T>(&self, path: &str, body: Option<B>) -> Result<T>
    where
        B: Serialize,
        T: DeserializeOwned,
    {
        let url = self.build_url(path)?;
        let mut request = self.http_client.post(url);

        if let Some(body) = body {
            request = request.json(&body);
        }

        self.execute_request(request).await
    }

    /// Make a PUT request
    pub async fn put<B, T>(&self, path: &str, body: Option<B>) -> Result<T>
    where
        B: Serialize,
        T: DeserializeOwned,
    {
        let url = self.build_url(path)?;
        let mut request = self.http_client.put(url);

        if let Some(body) = body {
            request = request.json(&body);
        }

        self.execute_request(request).await
    }

    /// Make a DELETE request
    pub async fn delete<T>(&self, path: &str) -> Result<T>
    where
        T: DeserializeOwned,
    {
        let url = self.build_url(path)?;
        let request = self.http_client.delete(url);
        self.execute_request(request).await
    }

    /// Execute a request with authentication and error handling
    async fn execute_request<T>(&self, mut request: RequestBuilder) -> Result<T>
    where
        T: DeserializeOwned,
    {
        // Add authentication headers
        let auth_headers = self.auth_provider.get_auth_headers().await?;
        for (key, value) in auth_headers {
            request = request.header(key, value);
        }

        // Add user agent
        request = request.header("User-Agent", &self.user_agent);

        // Execute the request
        let response = request.send().await?;
        
        debug!("HTTP {} {}: {}", 
            response.request().map(|r| r.method()).unwrap_or(&Method::GET),
            response.request().map(|r| r.url()).map(|u| u.as_str()).unwrap_or("unknown"),
            response.status()
        );

        self.handle_response(response).await
    }

    /// Handle the HTTP response and deserialize the result
    async fn handle_response<T>(&self, response: Response) -> Result<T>
    where
        T: DeserializeOwned,
    {
        let status = response.status();
        let url = response.url().clone();

        if status.is_success() {
            let text = response.text().await?;
            debug!("Response body: {}", text);
            
            serde_json::from_str(&text)
                .map_err(|e| anyhow!("Failed to deserialize response from {}: {}", url, e))
        } else {
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            error!("HTTP error {} from {}: {}", status, url, error_text);
            
            match status {
                StatusCode::BAD_REQUEST => Err(anyhow!("Bad request: {}", error_text)),
                StatusCode::UNAUTHORIZED => Err(anyhow!("Unauthorized: {}", error_text)),
                StatusCode::FORBIDDEN => Err(anyhow!("Forbidden: {}", error_text)),
                StatusCode::NOT_FOUND => Err(anyhow!("Not found: {}", error_text)),
                StatusCode::TOO_MANY_REQUESTS => Err(anyhow!("Rate limit exceeded: {}", error_text)),
                StatusCode::INTERNAL_SERVER_ERROR => Err(anyhow!("Internal server error: {}", error_text)),
                StatusCode::BAD_GATEWAY => Err(anyhow!("Bad gateway: {}", error_text)),
                StatusCode::SERVICE_UNAVAILABLE => Err(anyhow!("Service unavailable: {}", error_text)),
                _ => Err(anyhow!("HTTP error {}: {}", status, error_text)),
            }
        }
    }

    /// Build a full URL from a path
    fn build_url(&self, path: &str) -> Result<Url> {
        let path = if path.starts_with('/') {
            &path[1..]
        } else {
            path
        };

        self.base_url
            .join(path)
            .map_err(|e| anyhow!("Failed to build URL for path '{}': {}", path, e))
    }
}

/// Service-specific client implementations
pub mod services {
    use super::*;

    /// Pipeline service client
    pub struct PipelineService {
        client: Client,
    }

    impl PipelineService {
        /// Create a new pipeline service client
        pub fn new(client: Client) -> Self {
            Self { client }
        }

        /// List pipelines
        pub async fn list_pipelines(
            &self,
            scope: &Scope,
            options: &PipelineListOptions,
        ) -> Result<ListOutput<PipelineListItem>> {
            let path = format!(
                "pipeline/api/pipelines?accountIdentifier={}&orgIdentifier={}&projectIdentifier={}",
                scope.account_id,
                scope.org_id.as_deref().unwrap_or(""),
                scope.project_id.as_deref().unwrap_or("")
            );

            let mut params = HashMap::new();
            if let Some(search_term) = &options.search_term {
                params.insert("searchTerm".to_string(), search_term.clone());
            }
            if let Some(page) = options.pagination.page {
                params.insert("page".to_string(), page.to_string());
            }
            if let Some(size) = options.pagination.size {
                params.insert("size".to_string(), size.to_string());
            }

            self.client.get(&path, Some(params)).await
        }

        /// Get pipeline details
        pub async fn get_pipeline(
            &self,
            scope: &Scope,
            pipeline_id: &str,
        ) -> Result<Entity<PipelineData>> {
            let path = format!(
                "pipeline/api/pipelines/{}?accountIdentifier={}&orgIdentifier={}&projectIdentifier={}",
                pipeline_id,
                scope.account_id,
                scope.org_id.as_deref().unwrap_or(""),
                scope.project_id.as_deref().unwrap_or("")
            );

            self.client.get(&path, None).await
        }

        /// List pipeline executions
        pub async fn list_executions(
            &self,
            scope: &Scope,
            options: &PipelineExecutionOptions,
        ) -> Result<ListOutput<PipelineExecution>> {
            let path = format!(
                "pipeline/api/pipelines/execution/summary?accountIdentifier={}&orgIdentifier={}&projectIdentifier={}",
                scope.account_id,
                scope.org_id.as_deref().unwrap_or(""),
                scope.project_id.as_deref().unwrap_or("")
            );

            let mut params = HashMap::new();
            if let Some(search_term) = &options.search_term {
                params.insert("searchTerm".to_string(), search_term.clone());
            }
            if let Some(status) = &options.status {
                params.insert("status".to_string(), status.clone());
            }
            if let Some(pipeline_id) = &options.pipeline_identifier {
                params.insert("pipelineIdentifier".to_string(), pipeline_id.clone());
            }
            if let Some(page) = options.pagination.page {
                params.insert("page".to_string(), page.to_string());
            }
            if let Some(size) = options.pagination.size {
                params.insert("size".to_string(), size.to_string());
            }

            self.client.get(&path, Some(params)).await
        }

        /// Get execution details
        pub async fn get_execution(
            &self,
            scope: &Scope,
            plan_execution_id: &str,
        ) -> Result<Entity<PipelineExecution>> {
            let path = format!(
                "pipeline/api/pipelines/execution/{}?accountIdentifier={}&orgIdentifier={}&projectIdentifier={}",
                plan_execution_id,
                scope.account_id,
                scope.org_id.as_deref().unwrap_or(""),
                scope.project_id.as_deref().unwrap_or("")
            );

            self.client.get(&path, None).await
        }
    }

    /// Connector service client
    pub struct ConnectorService {
        client: Client,
    }

    impl ConnectorService {
        /// Create a new connector service client
        pub fn new(client: Client) -> Self {
            Self { client }
        }

        /// List connectors
        pub async fn list_connectors(
            &self,
            scope: &Scope,
            options: &PaginationOptions,
        ) -> Result<ListOutput<ConnectorListItem>> {
            let path = format!(
                "ng/api/connectors?accountIdentifier={}&orgIdentifier={}&projectIdentifier={}",
                scope.account_id,
                scope.org_id.as_deref().unwrap_or(""),
                scope.project_id.as_deref().unwrap_or("")
            );

            let mut params = HashMap::new();
            if let Some(page) = options.page {
                params.insert("page".to_string(), page.to_string());
            }
            if let Some(size) = options.size {
                params.insert("size".to_string(), size.to_string());
            }

            self.client.get(&path, Some(params)).await
        }

        /// Get connector details
        pub async fn get_connector(
            &self,
            scope: &Scope,
            connector_id: &str,
        ) -> Result<Entity<ConnectorDetails>> {
            let path = format!(
                "ng/api/connectors/{}?accountIdentifier={}&orgIdentifier={}&projectIdentifier={}",
                connector_id,
                scope.account_id,
                scope.org_id.as_deref().unwrap_or(""),
                scope.project_id.as_deref().unwrap_or("")
            );

            self.client.get(&path, None).await
        }
    }

    /// Dashboard service client
    pub struct DashboardService {
        client: Client,
    }

    impl DashboardService {
        /// Create a new dashboard service client
        pub fn new(client: Client) -> Self {
            Self { client }
        }

        /// List dashboards
        pub async fn list_dashboards(
            &self,
            scope: &Scope,
        ) -> Result<ListOutput<DashboardListItem>> {
            let path = format!(
                "dashboard/api/dashboards?accountIdentifier={}",
                scope.account_id
            );

            self.client.get(&path, None).await
        }

        /// Get dashboard data
        pub async fn get_dashboard_data(
            &self,
            scope: &Scope,
            dashboard_id: &str,
        ) -> Result<Entity<DashboardData>> {
            let path = format!(
                "dashboard/api/dashboards/{}?accountIdentifier={}",
                dashboard_id,
                scope.account_id
            );

            self.client.get(&path, None).await
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use harness_mcp_auth::ApiKeyProvider;

    #[tokio::test]
    async fn test_client_builder() {
        let base_url = Url::parse("https://app.harness.io").unwrap();
        let auth_provider = Box::new(ApiKeyProvider::new("test_key".to_string()));
        
        let client = Client::builder()
            .base_url(base_url)
            .auth_provider(auth_provider)
            .timeout(Duration::from_secs(10))
            .user_agent("test-client")
            .build();

        assert!(client.is_ok());
    }

    #[test]
    fn test_scope_creation() {
        let scope = Scope::project(
            "account123".to_string(),
            "org123".to_string(),
            "proj123".to_string(),
        );

        assert_eq!(scope.account_id, "account123");
        assert_eq!(scope.org_id, Some("org123".to_string()));
        assert_eq!(scope.project_id, Some("proj123".to_string()));
    }

    #[test]
    fn test_pagination_options_default() {
        let options = PaginationOptions::default();
        assert_eq!(options.page, Some(0));
        assert_eq!(options.size, Some(20));
    }
}