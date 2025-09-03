use crate::config::Config;
use crate::harness::client::HarnessClient;
use crate::harness::common;
use crate::harness::tools::{params, results, schema};
use crate::types::{HarnessError, PaginationOptions, Scope};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Pipeline service client for Harness API
pub struct PipelineService {
    client: HarnessClient,
}

impl PipelineService {
    pub fn new(client: HarnessClient) -> Self {
        Self { client }
    }

    /// Get details of a specific pipeline
    pub async fn get(&self, scope: &Scope, pipeline_id: &str) -> Result<PipelineResponse, HarnessError> {
        let path = format!(
            "pipeline/api/pipelines/{}?{}",
            pipeline_id,
            build_scope_query(scope)
        );

        let response = self.client
            .get(&path)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(HarnessError::Api(format!(
                "Failed to get pipeline: {}",
                response.status()
            )));
        }

        let pipeline_response: PipelineResponse = response.json().await?;
        Ok(pipeline_response)
    }

    /// List pipelines with optional filtering
    pub async fn list(
        &self,
        scope: &Scope,
        options: &PipelineListOptions,
    ) -> Result<PipelineListResponse, HarnessError> {
        let mut path = format!("pipeline/api/pipelines?{}", build_scope_query(scope));

        if let Some(search_term) = &options.search_term {
            path.push_str(&format!("&searchTerm={}", urlencoding::encode(search_term)));
        }

        if let Some(page) = options.pagination.page {
            path.push_str(&format!("&page={}", page));
        }

        if let Some(size) = options.pagination.size {
            path.push_str(&format!("&size={}", size));
        }

        let response = self.client
            .get(&path)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(HarnessError::Api(format!(
                "Failed to list pipelines: {}",
                response.status()
            )));
        }

        let list_response: PipelineListResponse = response.json().await?;
        Ok(list_response)
    }

    /// Get execution details
    pub async fn get_execution(
        &self,
        scope: &Scope,
        plan_execution_id: &str,
    ) -> Result<ExecutionResponse, HarnessError> {
        let path = format!(
            "pipeline/api/pipelines/execution/{}?{}",
            plan_execution_id,
            build_scope_query(scope)
        );

        let response = self.client
            .get(&path)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(HarnessError::Api(format!(
                "Failed to get execution: {}",
                response.status()
            )));
        }

        let execution_response: ExecutionResponse = response.json().await?;
        Ok(execution_response)
    }

    /// List pipeline executions
    pub async fn list_executions(
        &self,
        scope: &Scope,
        options: &ExecutionListOptions,
    ) -> Result<ExecutionListResponse, HarnessError> {
        let mut path = format!("pipeline/api/pipelines/execution?{}", build_scope_query(scope));

        if let Some(search_term) = &options.search_term {
            path.push_str(&format!("&searchTerm={}", urlencoding::encode(search_term)));
        }

        if let Some(pipeline_id) = &options.pipeline_identifier {
            path.push_str(&format!("&pipelineIdentifier={}", urlencoding::encode(pipeline_id)));
        }

        if let Some(status) = &options.status {
            path.push_str(&format!("&status={}", urlencoding::encode(status)));
        }

        if let Some(branch) = &options.branch {
            path.push_str(&format!("&branch={}", urlencoding::encode(branch)));
        }

        if let Some(my_deployments) = options.my_deployments {
            path.push_str(&format!("&myDeployments={}", my_deployments));
        }

        if let Some(page) = options.pagination.page {
            path.push_str(&format!("&page={}", page));
        }

        if let Some(size) = options.pagination.size {
            path.push_str(&format!("&size={}", size));
        }

        let response = self.client
            .get(&path)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(HarnessError::Api(format!(
                "Failed to list executions: {}",
                response.status()
            )));
        }

        let list_response: ExecutionListResponse = response.json().await?;
        Ok(list_response)
    }

    /// Fetch execution URL
    pub async fn fetch_execution_url(
        &self,
        scope: &Scope,
        pipeline_id: &str,
        plan_execution_id: &str,
    ) -> Result<String, HarnessError> {
        // Build the execution URL based on Harness URL patterns
        let base_url = self.client.base_url();
        let url = format!(
            "{}/ng/account/{}/cd/orgs/{}/projects/{}/pipelines/{}/executions/{}",
            base_url.trim_end_matches('/'),
            scope.account_id,
            scope.org_id.as_ref().unwrap_or(&"default".to_string()),
            scope.project_id.as_ref().unwrap_or(&"default".to_string()),
            pipeline_id,
            plan_execution_id
        );
        Ok(url)
    }
}

/// Pipeline data structures
#[derive(Debug, Serialize, Deserialize)]
pub struct Pipeline {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    pub tags: Option<std::collections::HashMap<String, String>>,
    pub version: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PipelineResponse {
    pub status: String,
    pub data: Pipeline,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PipelineListResponse {
    pub status: String,
    pub data: PipelineListData,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PipelineListData {
    pub content: Vec<Pipeline>,
    pub page_info: PageInfo,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PageInfo {
    pub page: u32,
    pub size: u32,
    pub total: u64,
    pub total_pages: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Execution {
    pub plan_execution_id: String,
    pub pipeline_identifier: String,
    pub status: String,
    pub start_ts: Option<i64>,
    pub end_ts: Option<i64>,
    pub created_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExecutionResponse {
    pub status: String,
    pub data: Execution,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExecutionListResponse {
    pub status: String,
    pub data: ExecutionListData,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExecutionListData {
    pub content: Vec<Execution>,
    pub page_info: PageInfo,
}

/// Options for listing pipelines
#[derive(Debug, Default)]
pub struct PipelineListOptions {
    pub search_term: Option<String>,
    pub pagination: PaginationOptions,
}

/// Options for listing executions
#[derive(Debug, Default)]
pub struct ExecutionListOptions {
    pub search_term: Option<String>,
    pub pipeline_identifier: Option<String>,
    pub status: Option<String>,
    pub branch: Option<String>,
    pub my_deployments: Option<bool>,
    pub pagination: PaginationOptions,
}

/// Pipeline tools implementation
pub struct PipelineTools {
    service: PipelineService,
    config: Config,
}

impl PipelineTools {
    pub fn new(service: PipelineService, config: Config) -> Self {
        Self { service, config }
    }

    /// Get pipeline tool
    pub async fn get_pipeline(&self, request: &Value) -> Result<Value, HarnessError> {
        let pipeline_id = params::required_param::<String>(request, "pipeline_id")?;
        let scope = common::fetch_scope(&self.config, request, true)?;

        let pipeline = self.service.get(&scope, &pipeline_id).await?;
        results::json_result(&serde_json::to_value(pipeline.data)?)
    }

    /// List pipelines tool
    pub async fn list_pipelines(&self, request: &Value) -> Result<Value, HarnessError> {
        let scope = common::fetch_scope(&self.config, request, true)?;
        let search_term = params::optional_param::<String>(request, "search_term")?;
        let pagination = params::optional_param::<PaginationOptions>(request, "pagination")?
            .unwrap_or_default();

        let options = PipelineListOptions {
            search_term,
            pagination,
        };

        let pipelines = self.service.list(&scope, &options).await?;
        results::json_result(&serde_json::to_value(pipelines)?)
    }

    /// Get execution tool
    pub async fn get_execution(&self, request: &Value) -> Result<Value, HarnessError> {
        let plan_execution_id = params::required_param::<String>(request, "plan_execution_id")?;
        let scope = common::fetch_scope(&self.config, request, true)?;

        let execution = self.service.get_execution(&scope, &plan_execution_id).await?;
        results::json_result(&serde_json::to_value(execution.data)?)
    }

    /// List executions tool
    pub async fn list_executions(&self, request: &Value) -> Result<Value, HarnessError> {
        let scope = common::fetch_scope(&self.config, request, true)?;
        let search_term = params::optional_param::<String>(request, "search_term")?;
        let pipeline_identifier = params::optional_param::<String>(request, "pipeline_identifier")?;
        let status = params::optional_param::<String>(request, "status")?;
        let branch = params::optional_param::<String>(request, "branch")?;
        let my_deployments = params::optional_param::<bool>(request, "my_deployments")?;
        let pagination = params::optional_param::<PaginationOptions>(request, "pagination")?
            .unwrap_or_default();

        let options = ExecutionListOptions {
            search_term,
            pipeline_identifier,
            status,
            branch,
            my_deployments,
            pagination,
        };

        let executions = self.service.list_executions(&scope, &options).await?;
        results::json_result(&serde_json::to_value(executions)?)
    }

    /// Fetch execution URL tool
    pub async fn fetch_execution_url(&self, request: &Value) -> Result<Value, HarnessError> {
        let pipeline_id = params::required_param::<String>(request, "pipeline_id")?;
        let plan_execution_id = params::required_param::<String>(request, "plan_execution_id")?;
        let scope = common::fetch_scope(&self.config, request, true)?;

        let url = self.service
            .fetch_execution_url(&scope, &pipeline_id, &plan_execution_id)
            .await?;
        
        Ok(results::text_result(url))
    }
}

/// Helper function to build scope query parameters
fn build_scope_query(scope: &Scope) -> String {
    let mut params = vec![format!("accountIdentifier={}", scope.account_id)];
    
    if let Some(org_id) = &scope.org_id {
        params.push(format!("orgIdentifier={}", org_id));
    }
    
    if let Some(project_id) = &scope.project_id {
        params.push(format!("projectIdentifier={}", project_id));
    }
    
    params.join("&")
}

