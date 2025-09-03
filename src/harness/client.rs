use crate::types::{HarnessError, Scope};
use reqwest::{Client, RequestBuilder};
use serde::{Deserialize, Serialize};
use std::time::Duration;

/// HTTP client for Harness API
pub struct HarnessClient {
    client: Client,
    base_url: String,
    api_key: Option<String>,
    bearer_token: Option<String>,
}

impl HarnessClient {
    /// Create a new Harness client
    pub fn new(base_url: String) -> Result<Self, HarnessError> {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .map_err(|e| HarnessError::Network(e))?;

        Ok(Self {
            client,
            base_url,
            api_key: None,
            bearer_token: None,
        })
    }

    /// Set API key for authentication
    pub fn with_api_key(mut self, api_key: String) -> Self {
        self.api_key = Some(api_key);
        self
    }

    /// Set bearer token for authentication
    pub fn with_bearer_token(mut self, token: String) -> Self {
        self.bearer_token = Some(token);
        self
    }

    /// Create a GET request
    pub fn get(&self, path: &str) -> RequestBuilder {
        let url = format!("{}/{}", self.base_url.trim_end_matches('/'), path.trim_start_matches('/'));
        let mut request = self.client.get(&url);
        
        request = self.add_auth_headers(request);
        request
    }

    /// Create a POST request
    pub fn post(&self, path: &str) -> RequestBuilder {
        let url = format!("{}/{}", self.base_url.trim_end_matches('/'), path.trim_start_matches('/'));
        let mut request = self.client.post(&url);
        
        request = self.add_auth_headers(request);
        request
    }

    /// Create a PUT request
    pub fn put(&self, path: &str) -> RequestBuilder {
        let url = format!("{}/{}", self.base_url.trim_end_matches('/'), path.trim_start_matches('/'));
        let mut request = self.client.put(&url);
        
        request = self.add_auth_headers(request);
        request
    }

    /// Create a DELETE request
    pub fn delete(&self, path: &str) -> RequestBuilder {
        let url = format!("{}/{}", self.base_url.trim_end_matches('/'), path.trim_start_matches('/'));
        let mut request = self.client.delete(&url);
        
        request = self.add_auth_headers(request);
        request
    }

    /// Get the base URL
    pub fn base_url(&self) -> &str {
        &self.base_url
    }

    /// Add authentication headers to request
    fn add_auth_headers(&self, mut request: RequestBuilder) -> RequestBuilder {
        if let Some(api_key) = &self.api_key {
            request = request.header("x-api-key", api_key);
        }
        
        if let Some(bearer_token) = &self.bearer_token {
            request = request.header("Authorization", format!("Bearer {}", bearer_token));
        }
        
        request = request.header("Content-Type", "application/json");
        request
    }
}

/// Generic API response wrapper
#[derive(Debug, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub status: String,
    pub data: Option<T>,
    pub error: Option<String>,
}

/// Pagination information
#[derive(Debug, Serialize, Deserialize)]
pub struct PageInfo {
    pub page: u32,
    pub size: u32,
    pub total: u32,
    pub total_pages: u32,
}

/// Paginated response
#[derive(Debug, Serialize, Deserialize)]
pub struct PaginatedResponse<T> {
    pub data: Vec<T>,
    pub page_info: PageInfo,
}

/// Build scope-aware API path
pub fn build_scoped_path(base_path: &str, scope: &Scope) -> String {
    let mut path = format!("ng/api/{}", base_path.trim_start_matches('/'));
    
    // Add account parameter
    path = format!("{}?accountIdentifier={}", path, scope.account_id);
    
    // Add org parameter if present
    if let Some(org_id) = &scope.org_id {
        path = format!("{}&orgIdentifier={}", path, org_id);
    }
    
    // Add project parameter if present
    if let Some(project_id) = &scope.project_id {
        path = format!("{}&projectIdentifier={}", path, project_id);
    }
    
    path
}