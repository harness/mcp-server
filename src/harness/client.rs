use anyhow::Result;
use reqwest::{Client, RequestBuilder};
use reqwest_middleware::{ClientBuilder, ClientWithMiddleware};
use reqwest_retry::{RetryTransientMiddleware, policies::ExponentialBackoff};
use serde::{Deserialize, Serialize};
use std::time::Duration;

use crate::config::Config;

#[derive(Clone)]
pub struct HarnessClient {
    client: ClientWithMiddleware,
    config: Config,
}

impl HarnessClient {
    pub fn new(config: Config) -> Result<Self> {
        let retry_policy = ExponentialBackoff::builder()
            .retry_bounds(Duration::from_millis(100), Duration::from_secs(30))
            .build_with_max_retries(3);

        let client = ClientBuilder::new(Client::new())
            .with(RetryTransientMiddleware::new_with_policy(retry_policy))
            .build();

        Ok(Self { client, config })
    }

    pub fn get(&self, path: &str) -> RequestBuilder {
        let url = format!("{}/gateway/ng/api{}", self.config.base_url, path);
        self.client
            .get(&url)
            .header("x-api-key", &self.config.api_key)
            .header("Harness-Account", &self.config.account_id)
    }

    pub fn post(&self, path: &str) -> RequestBuilder {
        let url = format!("{}/gateway/ng/api{}", self.config.base_url, path);
        self.client
            .post(&url)
            .header("x-api-key", &self.config.api_key)
            .header("Harness-Account", &self.config.account_id)
            .header("Content-Type", "application/json")
    }

    pub fn put(&self, path: &str) -> RequestBuilder {
        let url = format!("{}/gateway/ng/api{}", self.config.base_url, path);
        self.client
            .put(&url)
            .header("x-api-key", &self.config.api_key)
            .header("Harness-Account", &self.config.account_id)
            .header("Content-Type", "application/json")
    }

    pub fn delete(&self, path: &str) -> RequestBuilder {
        let url = format!("{}/gateway/ng/api{}", self.config.base_url, path);
        self.client
            .delete(&url)
            .header("x-api-key", &self.config.api_key)
            .header("Harness-Account", &self.config.account_id)
    }

    pub fn add_org_project_headers(&self, mut builder: RequestBuilder) -> RequestBuilder {
        if let Some(org_id) = &self.config.org_id {
            builder = builder.header("Harness-Org", org_id);
        }
        if let Some(project_id) = &self.config.project_id {
            builder = builder.header("Harness-Project", project_id);
        }
        builder
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub status: String,
    pub data: Option<T>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PagedResponse<T> {
    pub content: Vec<T>,
    pub page_index: i32,
    pub page_size: i32,
    pub total_pages: i32,
    pub total_items: i64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    fn create_test_config() -> Config {
        Config {
            base_url: "https://app.harness.io".to_string(),
            api_key: "pat.test_account.test_token.xyz".to_string(),
            account_id: "test_account".to_string(),
            org_id: Some("test_org".to_string()),
            project_id: Some("test_project".to_string()),
            toolsets: HashSet::new(),
            read_only: false,
        }
    }

    #[test]
    fn test_harness_client_creation() {
        let config = create_test_config();
        let client = HarnessClient::new(config);
        assert!(client.is_ok());
    }
}