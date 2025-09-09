use crate::{HarnessClient, Result};
use harness_mcp_dto::{Pipeline, PipelineExecution, Scope};
use serde_json::Value;

#[derive(Clone)]
pub struct PipelineService {
    client: HarnessClient,
}

impl PipelineService {
    pub fn new(client: HarnessClient) -> Self {
        Self { client }
    }

    pub async fn get(&self, scope: &Scope, pipeline_id: &str) -> Result<Pipeline> {
        let path = format!(
            "/v1/orgs/{}/projects/{}/pipelines/{}",
            scope.org_id, scope.project_id, pipeline_id
        );
        self.client.get(&path).await
    }

    pub async fn list(&self, scope: &Scope, page: Option<u32>, size: Option<u32>) -> Result<Value> {
        let mut path = format!(
            "/v1/orgs/{}/projects/{}/pipelines",
            scope.org_id, scope.project_id
        );

        let mut query_params = Vec::new();
        if let Some(page) = page {
            query_params.push(format!("page={}", page));
        }
        if let Some(size) = size {
            query_params.push(format!("size={}", size));
        }

        if !query_params.is_empty() {
            path.push('?');
            path.push_str(&query_params.join("&"));
        }

        self.client.get(&path).await
    }

    pub async fn get_execution(
        &self,
        scope: &Scope,
        pipeline_id: &str,
        execution_id: &str,
    ) -> Result<PipelineExecution> {
        let path = format!(
            "/v1/orgs/{}/projects/{}/pipelines/{}/executions/{}",
            scope.org_id, scope.project_id, pipeline_id, execution_id
        );
        self.client.get(&path).await
    }

    pub async fn list_executions(
        &self,
        scope: &Scope,
        pipeline_id: &str,
        page: Option<u32>,
        size: Option<u32>,
    ) -> Result<Value> {
        let mut path = format!(
            "/v1/orgs/{}/projects/{}/pipelines/{}/executions",
            scope.org_id, scope.project_id, pipeline_id
        );

        let mut query_params = Vec::new();
        if let Some(page) = page {
            query_params.push(format!("page={}", page));
        }
        if let Some(size) = size {
            query_params.push(format!("size={}", size));
        }

        if !query_params.is_empty() {
            path.push('?');
            path.push_str(&query_params.join("&"));
        }

        self.client.get(&path).await
    }
}
