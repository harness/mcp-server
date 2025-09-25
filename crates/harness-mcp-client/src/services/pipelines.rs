//! Pipeline service client implementation

use crate::client::Client;
use crate::dto::{
    ExecutionListOptions, ExecutionListResponse, ExecutionResponse, PipelineListOptions,
    PipelineListResponse, PipelineResponse, Scope,
};
use crate::error::{Error, Result};

/// Pipeline service client
#[derive(Clone)]
pub struct PipelineService {
    client: Client,
}

impl PipelineService {
    /// Create a new pipeline service client
    pub fn new(client: Client) -> Self {
        Self { client }
    }

    /// Get a specific pipeline
    pub async fn get(&self, scope: &Scope, pipeline_id: &str) -> Result<PipelineResponse> {
        let path = format!(
            "/ng/api/pipelines/{}/orgs/{}/projects/{}",
            pipeline_id, scope.org_id.as_deref().unwrap_or_default(), scope.project_id.as_deref().unwrap_or_default()
        );
        self.client.get(&path).await
    }

    /// List pipelines
    pub async fn list(
        &self,
        scope: &Scope,
        options: &PipelineListOptions,
    ) -> Result<PipelineListResponse> {
        let mut path = format!(
            "/ng/api/pipelines/list/orgs/{}/projects/{}",
            scope.org_id.as_deref().unwrap_or_default(),
            scope.project_id.as_deref().unwrap_or_default()
        );

        // Add query parameters
        let mut query_params = Vec::new();
        if let Some(page) = options.pagination.page {
            query_params.push(format!("page={}", page));
        }
        if let Some(size) = options.pagination.size {
            query_params.push(format!("size={}", size));
        }
        if let Some(ref search_term) = options.search_term {
            query_params.push(format!("searchTerm={}", urlencoding::encode(search_term)));
        }

        if !query_params.is_empty() {
            path.push('?');
            path.push_str(&query_params.join("&"));
        }

        self.client.get(&path).await
    }

    /// Get a specific execution
    pub async fn get_execution(
        &self,
        scope: &Scope,
        plan_execution_id: &str,
    ) -> Result<ExecutionResponse> {
        let path = format!(
            "/pipeline/api/pipelines/execution/{}/orgs/{}/projects/{}",
            plan_execution_id,
            scope.org_id.as_deref().unwrap_or_default(),
            scope.project_id.as_deref().unwrap_or_default()
        );
        self.client.get(&path).await
    }

    /// List executions
    pub async fn list_executions(
        &self,
        scope: &Scope,
        options: &ExecutionListOptions,
    ) -> Result<ExecutionListResponse> {
        let mut path = format!(
            "/pipeline/api/pipelines/execution/summary/orgs/{}/projects/{}",
            scope.org_id.as_deref().unwrap_or_default(),
            scope.project_id.as_deref().unwrap_or_default()
        );

        // Add query parameters
        let mut query_params = Vec::new();
        if let Some(page) = options.pagination.page {
            query_params.push(format!("page={}", page));
        }
        if let Some(size) = options.pagination.size {
            query_params.push(format!("size={}", size));
        }
        if let Some(ref pipeline_id) = options.pipeline_identifier {
            query_params.push(format!("pipelineIdentifier={}", urlencoding::encode(pipeline_id)));
        }
        if let Some(ref statuses) = options.status {
            for status in statuses {
                query_params.push(format!("status={}", urlencoding::encode(status)));
            }
        }

        if !query_params.is_empty() {
            path.push('?');
            path.push_str(&query_params.join("&"));
        }

        self.client.get(&path).await
    }

    /// Get execution URL
    pub async fn get_execution_url(
        &self,
        scope: &Scope,
        plan_execution_id: &str,
    ) -> Result<String> {
        // This would typically return a URL to the execution in the Harness UI
        Ok(format!(
            "https://app.harness.io/ng/account/{}/cd/orgs/{}/projects/{}/pipelines/executions/{}",
            scope.account_id,
            scope.org_id.as_deref().unwrap_or_default(),
            scope.project_id.as_deref().unwrap_or_default(),
            plan_execution_id
        ))
    }
}