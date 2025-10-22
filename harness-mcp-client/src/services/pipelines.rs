//! Pipeline service client

use crate::{
    client::HarnessClient,
    error::Result,
    types::{Scope, Entity, ListResponse, PipelineData, Pagination},
};
use serde::{Deserialize, Serialize};

/// Pipeline service client
pub struct PipelineService {
    client: HarnessClient,
}

impl PipelineService {
    /// Create a new pipeline service client
    pub fn new(client: HarnessClient) -> Self {
        Self { client }
    }

    /// List pipelines
    pub async fn list(&self, scope: &Scope, pagination: Option<Pagination>) -> Result<ListResponse<PipelineListItem>> {
        let mut request = self.client.get("/ng/api/pipelines").await?;
        request = self.client.add_scope_params(request, scope);

        if let Some(pagination) = pagination {
            if let Some(page) = pagination.page {
                request = request.query(&[("page", page.to_string())]);
            }
            if let Some(size) = pagination.size {
                request = request.query(&[("size", size.to_string())]);
            }
            if let Some(sort) = pagination.sort {
                request = request.query(&[("sort", sort)]);
            }
            if let Some(order) = pagination.order {
                request = request.query(&[("order", order)]);
            }
        }

        let response = self.client.execute_with_retry(request).await?;
        let list_response: ListResponse<PipelineListItem> = response.json().await?;
        Ok(list_response)
    }

    /// Get a specific pipeline
    pub async fn get(&self, scope: &Scope, pipeline_id: &str) -> Result<Entity<PipelineData>> {
        let path = format!("/ng/api/pipelines/{}", pipeline_id);
        let mut request = self.client.get(&path).await?;
        request = self.client.add_scope_params(request, scope);

        let response = self.client.execute_with_retry(request).await?;
        let entity: Entity<PipelineData> = response.json().await?;
        Ok(entity)
    }

    /// Execute a pipeline
    pub async fn execute(&self, scope: &Scope, pipeline_id: &str, execution_request: PipelineExecutionRequest) -> Result<Entity<PipelineExecutionResponse>> {
        let path = format!("/ng/api/pipelines/{}/execute", pipeline_id);
        let mut request = self.client.post(&path).await?;
        request = self.client.add_scope_params(request, scope);
        request = request.json(&execution_request);

        let response = self.client.execute_with_retry(request).await?;
        let entity: Entity<PipelineExecutionResponse> = response.json().await?;
        Ok(entity)
    }

    /// Get pipeline execution history
    pub async fn execution_history(&self, scope: &Scope, pipeline_id: &str, pagination: Option<Pagination>) -> Result<ListResponse<PipelineExecution>> {
        let path = format!("/ng/api/pipelines/{}/executions", pipeline_id);
        let mut request = self.client.get(&path).await?;
        request = self.client.add_scope_params(request, scope);

        if let Some(pagination) = pagination {
            if let Some(page) = pagination.page {
                request = request.query(&[("page", page.to_string())]);
            }
            if let Some(size) = pagination.size {
                request = request.query(&[("size", size.to_string())]);
            }
        }

        let response = self.client.execute_with_retry(request).await?;
        let list_response: ListResponse<PipelineExecution> = response.json().await?;
        Ok(list_response)
    }
}

/// Pipeline list item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineListItem {
    pub identifier: Option<String>,
    pub name: Option<String>,
    pub description: Option<String>,
    pub tags: Option<std::collections::HashMap<String, String>>,
    #[serde(rename = "storeType")]
    pub store_type: Option<String>,
    #[serde(rename = "connectorRef")]
    pub connector_ref: Option<String>,
    pub version: Option<i64>,
    #[serde(rename = "gitDetails")]
    pub git_details: Option<crate::types::GitDetails>,
    #[serde(rename = "entityValidityDetails")]
    pub entity_validity_details: Option<crate::types::EntityValidityDetails>,
    pub modules: Option<Vec<String>>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<i64>,
    #[serde(rename = "lastUpdatedAt")]
    pub last_updated_at: Option<i64>,
}

/// Pipeline execution request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineExecutionRequest {
    #[serde(rename = "runtimeInputYaml")]
    pub runtime_input_yaml: Option<String>,
    #[serde(rename = "inputSetReferences")]
    pub input_set_references: Option<Vec<String>>,
    pub branch: Option<String>,
    #[serde(rename = "connectorRef")]
    pub connector_ref: Option<String>,
    #[serde(rename = "repoName")]
    pub repo_name: Option<String>,
    #[serde(rename = "stageIdentifiers")]
    pub stage_identifiers: Option<Vec<String>>,
    #[serde(rename = "expressionValues")]
    pub expression_values: Option<std::collections::HashMap<String, String>>,
}

/// Pipeline execution response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineExecutionResponse {
    #[serde(rename = "planExecutionId")]
    pub plan_execution_id: Option<String>,
    #[serde(rename = "runSequence")]
    pub run_sequence: Option<i32>,
    pub status: Option<String>,
}

/// Pipeline execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineExecution {
    #[serde(rename = "planExecutionId")]
    pub plan_execution_id: Option<String>,
    #[serde(rename = "runSequence")]
    pub run_sequence: Option<i32>,
    #[serde(rename = "pipelineIdentifier")]
    pub pipeline_identifier: Option<String>,
    pub name: Option<String>,
    pub status: Option<String>,
    #[serde(rename = "executionTriggerInfo")]
    pub execution_trigger_info: Option<ExecutionTriggerInfo>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<i64>,
    #[serde(rename = "startTs")]
    pub start_ts: Option<i64>,
    #[serde(rename = "endTs")]
    pub end_ts: Option<i64>,
    #[serde(rename = "executionInputTemplate")]
    pub execution_input_template: Option<String>,
    pub modules: Option<Vec<String>>,
}

/// Execution trigger info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionTriggerInfo {
    #[serde(rename = "triggerType")]
    pub trigger_type: Option<String>,
    #[serde(rename = "triggeredBy")]
    pub triggered_by: Option<TriggeredBy>,
    #[serde(rename = "isRerun")]
    pub is_rerun: Option<bool>,
}

/// Triggered by info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TriggeredBy {
    pub uuid: Option<String>,
    pub identifier: Option<String>,
    #[serde(rename = "extraInfo")]
    pub extra_info: Option<std::collections::HashMap<String, String>>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::HarnessClient;

    #[tokio::test]
    async fn test_pipeline_service_creation() {
        let client = HarnessClient::with_api_key("pat.account123.token456.suffix").unwrap();
        let service = PipelineService::new(client);
        
        // Just test that the service can be created
        assert!(true);
    }
}