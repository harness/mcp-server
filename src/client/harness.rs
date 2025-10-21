use crate::client::{ClientConfig, HttpClient, PaginationParams, PagedResponse, ApiResponse};
use crate::config::Config;
use crate::error::{HarnessError, Result};
use crate::tools::common::Scope;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;
use tracing::{debug, info};

/// Harness API client
#[derive(Debug, Clone)]
pub struct HarnessClient {
    http_client: HttpClient,
    account_id: String,
}

impl HarnessClient {
    pub fn new(config: &Config) -> Result<Self> {
        let account_id = config.account_id.as_ref()
            .ok_or_else(|| HarnessError::Config(anyhow::anyhow!("Account ID not configured")))?
            .clone();
        
        let client_config = ClientConfig {
            base_url: config.base_url.as_ref()
                .unwrap_or(&"https://app.harness.io".to_string())
                .clone(),
            api_key: config.api_key.clone(),
            bearer_token: config.bearer_token.clone(),
            timeout: Duration::from_secs(30),
            user_agent: format!("harness-mcp-server/{}", env!("CARGO_PKG_VERSION")),
        };
        
        let http_client = HttpClient::new(client_config)?;
        
        Ok(Self {
            http_client,
            account_id,
        })
    }
    
    pub fn account_id(&self) -> &str {
        &self.account_id
    }
    
    /// Build API path with account scope
    fn build_path(&self, path: &str) -> String {
        format!("/gateway/ng/api/{}", path.trim_start_matches('/'))
    }
    
    /// Build API path with full scope (account, org, project)
    fn build_scoped_path(&self, scope: &Scope, path: &str) -> String {
        let mut query_params = vec![format!("accountIdentifier={}", scope.account_id)];
        
        if let Some(org_id) = &scope.org_id {
            query_params.push(format!("orgIdentifier={}", org_id));
        }
        
        if let Some(project_id) = &scope.project_id {
            query_params.push(format!("projectIdentifier={}", project_id));
        }
        
        let base_path = self.build_path(path);
        format!("{}?{}", base_path, query_params.join("&"))
    }
    
    /// Add pagination parameters to query string
    fn add_pagination_params(&self, path: &str, pagination: &PaginationParams) -> String {
        let mut params = Vec::new();
        
        if let Some(page) = pagination.page {
            params.push(format!("page={}", page));
        }
        
        if let Some(size) = pagination.size {
            params.push(format!("size={}", size));
        }
        
        if let Some(sort) = &pagination.sort {
            for sort_field in sort {
                params.push(format!("sort={}", sort_field));
            }
        }
        
        if params.is_empty() {
            path.to_string()
        } else {
            let separator = if path.contains('?') { "&" } else { "?" };
            format!("{}{}{}", path, separator, params.join("&"))
        }
    }
}

// Pipeline API methods
impl HarnessClient {
    pub async fn get_pipeline(&self, scope: &Scope, pipeline_id: &str) -> Result<PipelineResponse> {
        let path = self.build_scoped_path(scope, &format!("pipelines/{}", pipeline_id));
        
        debug!("Getting pipeline: {}", pipeline_id);
        let response: ApiResponse<PipelineResponse> = self.http_client
            .execute_json(self.http_client.get(&path))
            .await?;
        
        response.data.ok_or_else(|| HarnessError::Api("No pipeline data in response".to_string()))
    }
    
    pub async fn list_pipelines(
        &self,
        scope: &Scope,
        pagination: &PaginationParams,
        search_term: Option<&str>,
    ) -> Result<PagedResponse<PipelineListItem>> {
        let mut path = self.build_scoped_path(scope, "pipelines");
        path = self.add_pagination_params(&path, pagination);
        
        if let Some(search) = search_term {
            path = format!("{}&searchTerm={}", path, urlencoding::encode(search));
        }
        
        debug!("Listing pipelines with search: {:?}", search_term);
        self.http_client.execute_json(self.http_client.get(&path)).await
    }
    
    pub async fn get_pipeline_execution(
        &self,
        scope: &Scope,
        execution_id: &str,
    ) -> Result<ExecutionResponse> {
        let path = self.build_scoped_path(scope, &format!("pipelines/execution/{}", execution_id));
        
        debug!("Getting pipeline execution: {}", execution_id);
        let response: ApiResponse<ExecutionResponse> = self.http_client
            .execute_json(self.http_client.get(&path))
            .await?;
        
        response.data.ok_or_else(|| HarnessError::Api("No execution data in response".to_string()))
    }
    
    pub async fn list_pipeline_executions(
        &self,
        scope: &Scope,
        pipeline_id: Option<&str>,
        pagination: &PaginationParams,
    ) -> Result<PagedResponse<ExecutionListItem>> {
        let mut path = self.build_scoped_path(scope, "pipelines/execution");
        path = self.add_pagination_params(&path, pagination);
        
        if let Some(pipeline) = pipeline_id {
            path = format!("{}&pipelineIdentifier={}", path, pipeline);
        }
        
        debug!("Listing pipeline executions for pipeline: {:?}", pipeline_id);
        self.http_client.execute_json(self.http_client.get(&path)).await
    }
}

// Connector API methods
impl HarnessClient {
    pub async fn list_connectors(
        &self,
        scope: &Scope,
        pagination: &PaginationParams,
        search_term: Option<&str>,
        category: Option<&str>,
    ) -> Result<PagedResponse<ConnectorListItem>> {
        let mut path = self.build_scoped_path(scope, "connectors");
        path = self.add_pagination_params(&path, pagination);
        
        if let Some(search) = search_term {
            path = format!("{}&searchTerm={}", path, urlencoding::encode(search));
        }
        
        if let Some(cat) = category {
            path = format!("{}&category={}", path, cat);
        }
        
        debug!("Listing connectors with search: {:?}, category: {:?}", search_term, category);
        self.http_client.execute_json(self.http_client.get(&path)).await
    }
    
    pub async fn get_connector(&self, scope: &Scope, connector_id: &str) -> Result<ConnectorResponse> {
        let path = self.build_scoped_path(scope, &format!("connectors/{}", connector_id));
        
        debug!("Getting connector: {}", connector_id);
        let response: ApiResponse<ConnectorResponse> = self.http_client
            .execute_json(self.http_client.get(&path))
            .await?;
        
        response.data.ok_or_else(|| HarnessError::Api("No connector data in response".to_string()))
    }
}

// Data types for API responses
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineResponse {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    pub tags: Option<HashMap<String, String>>,
    pub version: Option<i64>,
    #[serde(rename = "gitDetails")]
    pub git_details: Option<GitDetails>,
    pub yaml: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineListItem {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    pub tags: Option<HashMap<String, String>>,
    #[serde(rename = "recentExecutionsInfo")]
    pub recent_executions_info: Option<Vec<ExecutionInfo>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResponse {
    #[serde(rename = "planExecutionId")]
    pub plan_execution_id: String,
    #[serde(rename = "pipelineIdentifier")]
    pub pipeline_identifier: String,
    pub status: String,
    #[serde(rename = "startTs")]
    pub start_ts: Option<i64>,
    #[serde(rename = "endTs")]
    pub end_ts: Option<i64>,
    #[serde(rename = "executionTriggerInfo")]
    pub execution_trigger_info: Option<TriggerInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionListItem {
    #[serde(rename = "planExecutionId")]
    pub plan_execution_id: String,
    #[serde(rename = "pipelineIdentifier")]
    pub pipeline_identifier: String,
    pub name: Option<String>,
    pub status: String,
    #[serde(rename = "startTs")]
    pub start_ts: Option<i64>,
    #[serde(rename = "endTs")]
    pub end_ts: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorResponse {
    pub connector: ConnectorDetails,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorListItem {
    pub connector: ConnectorDetails,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorDetails {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "type")]
    pub connector_type: String,
    pub category: Option<String>,
    pub tags: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitDetails {
    #[serde(rename = "repoIdentifier")]
    pub repo_identifier: Option<String>,
    #[serde(rename = "rootFolder")]
    pub root_folder: Option<String>,
    #[serde(rename = "filePath")]
    pub file_path: Option<String>,
    #[serde(rename = "repoName")]
    pub repo_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionInfo {
    #[serde(rename = "planExecutionId")]
    pub plan_execution_id: String,
    pub status: String,
    #[serde(rename = "startTs")]
    pub start_ts: Option<i64>,
    #[serde(rename = "endTs")]
    pub end_ts: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TriggerInfo {
    #[serde(rename = "triggerType")]
    pub trigger_type: String,
    #[serde(rename = "triggeredBy")]
    pub triggered_by: Option<TriggeredBy>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TriggeredBy {
    pub uuid: Option<String>,
    pub identifier: Option<String>,
    #[serde(rename = "extraInfo")]
    pub extra_info: Option<HashMap<String, String>>,
}