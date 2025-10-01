use crate::auth::AuthProvider;
use crate::error::{HarnessError, Result};
use reqwest::{Client, Response};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tracing::{debug, warn};

pub mod harness;
pub mod retry;

pub use harness::*;
pub use retry::*;

#[derive(Clone)]
pub struct HarnessClient {
    client: Client,
    base_url: String,
    auth_provider: Arc<dyn AuthProvider>,
    retry_policy: RetryPolicy,
}

impl HarnessClient {
    pub fn new(
        base_url: String,
        auth_provider: Arc<dyn AuthProvider>,
        timeout: Option<Duration>,
    ) -> Result<Self> {
        let client = Client::builder()
            .timeout(timeout.unwrap_or(Duration::from_secs(30)))
            .pool_max_idle_per_host(10)
            .pool_idle_timeout(Duration::from_secs(90))
            .build()?;
        
        Ok(Self {
            client,
            base_url,
            auth_provider,
            retry_policy: RetryPolicy::default(),
        })
    }
    
    pub fn with_retry_policy(mut self, policy: RetryPolicy) -> Self {
        self.retry_policy = policy;
        self
    }
    
    pub async fn get<T>(&self, path: &str, query: Option<&HashMap<String, String>>) -> Result<T>
    where
        T: for<'de> Deserialize<'de>,
    {
        let url = format!("{}{}", self.base_url, path);
        let mut request = self.client.get(&url);
        
        if let Some(query_params) = query {
            request = request.query(query_params);
        }
        
        self.execute_with_retry(request).await
    }
    
    pub async fn post<T, B>(&self, path: &str, body: &B) -> Result<T>
    where
        T: for<'de> Deserialize<'de>,
        B: Serialize,
    {
        let url = format!("{}{}", self.base_url, path);
        let request = self.client.post(&url).json(body);
        
        self.execute_with_retry(request).await
    }
    
    pub async fn put<T, B>(&self, path: &str, body: &B) -> Result<T>
    where
        T: for<'de> Deserialize<'de>,
        B: Serialize,
    {
        let url = format!("{}{}", self.base_url, path);
        let request = self.client.put(&url).json(body);
        
        self.execute_with_retry(request).await
    }
    
    pub async fn delete<T>(&self, path: &str) -> Result<T>
    where
        T: for<'de> Deserialize<'de>,
    {
        let url = format!("{}{}", self.base_url, path);
        let request = self.client.delete(&url);
        
        self.execute_with_retry(request).await
    }
    
    async fn execute_with_retry<T>(&self, mut request: reqwest::RequestBuilder) -> Result<T>
    where
        T: for<'de> Deserialize<'de>,
    {
        // Add authentication headers
        let dummy_session = crate::auth::AuthSession {
            principal: crate::auth::Principal {
                user_id: "system".to_string(),
                email: "system@harness.io".to_string(),
                username: "System".to_string(),
                account_id: "system".to_string(),
                principal_type: crate::auth::PrincipalType::Service,
            },
            account_id: "system".to_string(),
        };
        
        let (header_name, header_value) = self.auth_provider.get_auth_header(&dummy_session)?;
        request = request.header(&header_name, &header_value);
        
        // Add common headers
        request = request
            .header("Content-Type", "application/json")
            .header("Accept", "application/json");
        
        let mut attempts = 0;
        let max_attempts = self.retry_policy.max_attempts;
        
        loop {
            attempts += 1;
            
            let request_clone = request
                .try_clone()
                .ok_or_else(|| HarnessError::Internal("Failed to clone request".to_string()))?;
            
            match request_clone.send().await {
                Ok(response) => {
                    if response.status().is_success() {
                        return self.parse_response(response).await;
                    } else if self.should_retry(response.status().as_u16()) && attempts < max_attempts {
                        warn!(
                            "Request failed with status {}, retrying ({}/{})",
                            response.status(),
                            attempts,
                            max_attempts
                        );
                        
                        let delay = self.retry_policy.calculate_delay(attempts);
                        tokio::time::sleep(delay).await;
                        continue;
                    } else {
                        return Err(HarnessError::HttpClient(
                            reqwest::Error::from(response.error_for_status().unwrap_err())
                        ));
                    }
                }
                Err(e) => {
                    if attempts < max_attempts && self.is_retryable_error(&e) {
                        warn!("Request failed with error: {}, retrying ({}/{})", e, attempts, max_attempts);
                        
                        let delay = self.retry_policy.calculate_delay(attempts);
                        tokio::time::sleep(delay).await;
                        continue;
                    } else {
                        return Err(HarnessError::HttpClient(e));
                    }
                }
            }
        }
    }
    
    async fn parse_response<T>(&self, response: Response) -> Result<T>
    where
        T: for<'de> Deserialize<'de>,
    {
        let text = response.text().await?;
        debug!("Response body: {}", text);
        
        serde_json::from_str(&text).map_err(HarnessError::from)
    }
    
    fn should_retry(&self, status_code: u16) -> bool {
        matches!(status_code, 429 | 500..=599)
    }
    
    fn is_retryable_error(&self, error: &reqwest::Error) -> bool {
        error.is_timeout() || error.is_connect() || error.is_request()
    }
}