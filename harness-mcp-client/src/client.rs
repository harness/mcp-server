use crate::dto::*;
use crate::error::{ClientError, Result};
use reqwest::{Client, RequestBuilder};
use serde::de::DeserializeOwned;
use std::time::Duration;
use tracing::{debug, warn};

pub struct HarnessClient {
    client: Client,
    base_url: String,
    api_key: String,
    account_id: String,
}

impl HarnessClient {
    pub fn new(base_url: String, api_key: String, account_id: String) -> Result<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .map_err(ClientError::HttpError)?;

        Ok(Self {
            client,
            base_url,
            api_key,
            account_id,
        })
    }

    pub async fn get<T: DeserializeOwned>(&self, path: &str) -> Result<T> {
        let url = format!("{}/{}", self.base_url.trim_end_matches('/'), path.trim_start_matches('/'));
        debug!("GET {}", url);

        let response = self
            .client
            .get(&url)
            .header("x-api-key", &self.api_key)
            .header("Harness-Account", &self.account_id)
            .send()
            .await
            .map_err(ClientError::HttpError)?;

        self.handle_response(response).await
    }

    pub async fn post<T: DeserializeOwned, B: serde::Serialize>(&self, path: &str, body: &B) -> Result<T> {
        let url = format!("{}/{}", self.base_url.trim_end_matches('/'), path.trim_start_matches('/'));
        debug!("POST {}", url);

        let response = self
            .client
            .post(&url)
            .header("x-api-key", &self.api_key)
            .header("Harness-Account", &self.account_id)
            .header("Content-Type", "application/json")
            .json(body)
            .send()
            .await
            .map_err(ClientError::HttpError)?;

        self.handle_response(response).await
    }

    async fn handle_response<T: DeserializeOwned>(&self, response: reqwest::Response) -> Result<T> {
        let status = response.status();
        let text = response.text().await.map_err(ClientError::HttpError)?;

        if status.is_success() {
            serde_json::from_str(&text).map_err(ClientError::JsonError)
        } else {
            warn!("HTTP error {}: {}", status, text);
            Err(ClientError::ApiError {
                status: status.as_u16(),
                message: text,
            })
        }
    }
}

// Service-specific clients
pub struct PipelineService {
    client: HarnessClient,
}

impl PipelineService {
    pub fn new(client: HarnessClient) -> Self {
        Self { client }
    }

    pub async fn list_pipelines(&self, scope: &Scope, options: &PipelineListOptions) -> Result<PaginatedResponse<Pipeline>> {
        let mut path = format!("pipeline/api/pipelines");
        
        // Add query parameters
        let mut params = vec![
            ("accountIdentifier", scope.account_id.as_str()),
        ];
        
        if let Some(ref org_id) = scope.org_id {
            params.push(("orgIdentifier", org_id));
        }
        
        if let Some(ref project_id) = scope.project_id {
            params.push(("projectIdentifier", project_id));
        }

        if let Some(page) = options.page {
            params.push(("page", &page.to_string()));
        }

        if let Some(size) = options.size {
            params.push(("size", &size.to_string()));
        }

        if let Some(ref search) = options.search_term {
            params.push(("searchTerm", search));
        }

        if !params.is_empty() {
            path.push('?');
            path.push_str(&params.iter()
                .map(|(k, v)| format!("{}={}", k, urlencoding::encode(v)))
                .collect::<Vec<_>>()
                .join("&"));
        }

        self.client.get(&path).await
    }

    pub async fn get_pipeline(&self, scope: &Scope, pipeline_id: &str) -> Result<Pipeline> {
        let path = format!(
            "pipeline/api/pipelines/{}?accountIdentifier={}&orgIdentifier={}&projectIdentifier={}",
            pipeline_id,
            scope.account_id,
            scope.org_id.as_deref().unwrap_or(""),
            scope.project_id.as_deref().unwrap_or("")
        );

        self.client.get(&path).await
    }
}

// Add more service clients as needed...