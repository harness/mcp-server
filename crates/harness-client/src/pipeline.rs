use crate::client::{HarnessClient, ClientError, HarnessResponse, PaginatedResponse};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Pipeline client for Harness Pipeline service
/// Migrated from Go client.PipelineService
#[derive(Debug, Clone)]
pub struct PipelineClient {
    client: HarnessClient,
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
        org_id: Option<&str>,
        project_id: Option<&str>,
        page: Option<i32>,
        size: Option<i32>,
    ) -> Result<PaginatedResponse<Pipeline>, ClientError> {
        let mut path = format!("v1/pipelines?accountIdentifier={}", account_id);
        
        if let Some(org) = org_id {
            path.push_str(&format!("&orgIdentifier={}", org));
        }
        if let Some(project) = project_id {
            path.push_str(&format!("&projectIdentifier={}", project));
        }
        if let Some(p) = page {
            path.push_str(&format!("&page={}", p));
        }
        if let Some(s) = size {
            path.push_str(&format!("&size={}", s));
        }

        let request = self.client.get(&path);
        let response: HarnessResponse<PaginatedResponse<Pipeline>> = 
            self.client.execute_request(request).await?;

        response.data.ok_or_else(|| ClientError::ParseError("No data in response".to_string()))
    }

    /// Get pipeline details
    pub async fn get_pipeline(
        &self,
        account_id: &str,
        org_id: &str,
        project_id: &str,
        pipeline_id: &str,
    ) -> Result<Pipeline, ClientError> {
        let path = format!(
            "v1/pipelines/{}?accountIdentifier={}&orgIdentifier={}&projectIdentifier={}",
            pipeline_id, account_id, org_id, project_id
        );

        let request = self.client.get(&path);
        let response: HarnessResponse<Pipeline> = self.client.execute_request(request).await?;

        response.data.ok_or_else(|| ClientError::ParseError("No data in response".to_string()))
    }

    /// List pipeline executions
    pub async fn list_executions(
        &self,
        account_id: &str,
        org_id: &str,
        project_id: &str,
        pipeline_id: &str,
        page: Option<i32>,
        size: Option<i32>,
    ) -> Result<PaginatedResponse<PipelineExecution>, ClientError> {
        let mut path = format!(
            "v1/pipelines/{}/executions?accountIdentifier={}&orgIdentifier={}&projectIdentifier={}",
            pipeline_id, account_id, org_id, project_id
        );

        if let Some(p) = page {
            path.push_str(&format!("&page={}", p));
        }
        if let Some(s) = size {
            path.push_str(&format!("&size={}", s));
        }

        let request = self.client.get(&path);
        let response: HarnessResponse<PaginatedResponse<PipelineExecution>> = 
            self.client.execute_request(request).await?;

        response.data.ok_or_else(|| ClientError::ParseError("No data in response".to_string()))
    }

    /// Get execution details
    pub async fn get_execution(
        &self,
        account_id: &str,
        org_id: &str,
        project_id: &str,
        pipeline_id: &str,
        execution_id: &str,
    ) -> Result<PipelineExecution, ClientError> {
        let path = format!(
            "v1/pipelines/{}/executions/{}?accountIdentifier={}&orgIdentifier={}&projectIdentifier={}",
            pipeline_id, execution_id, account_id, org_id, project_id
        );

        let request = self.client.get(&path);
        let response: HarnessResponse<PipelineExecution> = self.client.execute_request(request).await?;

        response.data.ok_or_else(|| ClientError::ParseError("No data in response".to_string()))
    }
}

/// Pipeline data structure
/// Migrated from Go pipeline structures
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pipeline {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    pub tags: Option<HashMap<String, String>>,
    pub version: Option<i64>,
    pub git_details: Option<GitDetails>,
    pub entity_validity_details: Option<EntityValidityDetails>,
    pub created: Option<i64>,
    pub updated: Option<i64>,
}

/// Pipeline execution data structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineExecution {
    pub plan_execution_id: String,
    pub run_sequence: Option<i32>,
    pub pipeline_identifier: String,
    pub status: String,
    pub start_ts: Option<i64>,
    pub end_ts: Option<i64>,
    pub created_at: Option<i64>,
    pub updated_at: Option<i64>,
    pub execution_trigger_info: Option<ExecutionTriggerInfo>,
    pub execution_input_configured: Option<bool>,
    pub tags: Option<Vec<ExecutionTag>>,
}

/// Git details for pipeline
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitDetails {
    pub object_id: Option<String>,
    pub branch: Option<String>,
    pub repo_identifier: Option<String>,
    pub root_folder: Option<String>,
    pub file_path: Option<String>,
    pub commit_id: Option<String>,
}

/// Entity validity details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityValidityDetails {
    pub valid: Option<bool>,
    pub invalid_yaml: Option<String>,
}

/// Execution trigger information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionTriggerInfo {
    pub trigger_type: Option<String>,
    pub triggered_by: Option<TriggeredBy>,
}

/// Information about who triggered the execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TriggeredBy {
    pub uuid: Option<String>,
    pub identifier: Option<String>,
    pub extra_info: Option<HashMap<String, String>>,
}

/// Execution tag
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionTag {
    pub key: String,
    pub value: String,
}