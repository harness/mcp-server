//! Pipeline service client

use crate::{client::HarnessClient, error::ClientResult};
use serde::{Deserialize, Serialize};

/// Pipeline service client
pub struct PipelineClient {
    client: HarnessClient,
}

/// Pipeline information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pipeline {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    pub project_identifier: String,
    pub org_identifier: String,
}

/// Pipeline execution information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineExecution {
    pub plan_execution_id: String,
    pub pipeline_identifier: String,
    pub status: String,
    pub start_ts: Option<u64>,
    pub end_ts: Option<u64>,
}

impl PipelineClient {
    /// Create a new pipeline client
    pub fn new(client: HarnessClient) -> Self {
        Self { client }
    }

    /// List pipelines
    pub async fn list_pipelines(
        &self,
        account_id: &str,
        org_id: &str,
        project_id: &str,
    ) -> ClientResult<Vec<Pipeline>> {
        let path = format!(
            "pipeline/api/pipelines/list?accountIdentifier={}&orgIdentifier={}&projectIdentifier={}",
            account_id, org_id, project_id
        );

        let request = self.client.get(&path);
        self.client.execute(request).await
    }

    /// Get pipeline details
    pub async fn get_pipeline(
        &self,
        account_id: &str,
        org_id: &str,
        project_id: &str,
        pipeline_id: &str,
    ) -> ClientResult<Pipeline> {
        let path = format!(
            "pipeline/api/pipelines/{}?accountIdentifier={}&orgIdentifier={}&projectIdentifier={}",
            pipeline_id, account_id, org_id, project_id
        );

        let request = self.client.get(&path);
        self.client.execute(request).await
    }

    /// List pipeline executions
    pub async fn list_executions(
        &self,
        account_id: &str,
        org_id: &str,
        project_id: &str,
        pipeline_id: &str,
    ) -> ClientResult<Vec<PipelineExecution>> {
        let path = format!(
            "pipeline/api/pipelines/execution/summary?accountIdentifier={}&orgIdentifier={}&projectIdentifier={}&pipelineIdentifier={}",
            account_id, org_id, project_id, pipeline_id
        );

        let request = self.client.get(&path);
        self.client.execute(request).await
    }

    /// Get execution details
    pub async fn get_execution(
        &self,
        account_id: &str,
        plan_execution_id: &str,
    ) -> ClientResult<PipelineExecution> {
        let path = format!(
            "pipeline/api/pipelines/execution/{}?accountIdentifier={}",
            plan_execution_id, account_id
        );

        let request = self.client.get(&path);
        self.client.execute(request).await
    }
}
