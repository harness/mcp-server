use crate::{Result, ToolError};
use harness_mcp_client::HarnessClient;
use harness_mcp_dto::Scope;
use serde_json::Value;
use tracing::{debug, error, info};

#[derive(Clone)]
pub struct PipelineTools {
    client: HarnessClient,
}

impl PipelineTools {
    pub fn new(client: HarnessClient) -> Self {
        Self { client }
    }

    pub async fn get_pipeline(&self, params: Value) -> Result<Value> {
        let pipeline_id = params["pipeline_id"]
            .as_str()
            .ok_or_else(|| ToolError::InvalidParameters("Missing pipeline_id".to_string()))?;
        let org_id = params["org_id"]
            .as_str()
            .ok_or_else(|| ToolError::InvalidParameters("Missing org_id".to_string()))?;
        let project_id = params["project_id"]
            .as_str()
            .ok_or_else(|| ToolError::InvalidParameters("Missing project_id".to_string()))?;

        info!(
            "Getting pipeline: {} in org: {}, project: {}",
            pipeline_id, org_id, project_id
        );

        let scope = Scope {
            account_id: "".to_string(),
            org_id: org_id.to_string(),
            project_id: project_id.to_string(),
        };

        let pipeline_service = self.client.pipelines();
        let pipeline = pipeline_service
            .get(&scope, pipeline_id)
            .await
            .map_err(|e| {
                error!("Failed to get pipeline {}: {}", pipeline_id, e);
                ToolError::ToolExecutionFailed {
                    tool: "get_pipeline".to_string(),
                    params: format!(
                        "pipeline_id={}, org_id={}, project_id={}",
                        pipeline_id, org_id, project_id
                    ),
                    reason: e.to_string(),
                }
            })?;

        debug!("Successfully retrieved pipeline data");
        Ok(serde_json::json!({
            "content": [{
                "type": "text",
                "text": format!("Pipeline Data:\\n{}",
                    serde_json::to_string_pretty(&pipeline).unwrap_or_default()
                )
            }]
        }))
    }

    pub async fn list_pipelines(&self, params: Value) -> Result<Value> {
        let org_id = params["org_id"]
            .as_str()
            .ok_or_else(|| ToolError::InvalidParameters("Missing org_id".to_string()))?;
        let project_id = params["project_id"]
            .as_str()
            .ok_or_else(|| ToolError::InvalidParameters("Missing project_id".to_string()))?;

        let scope = Scope {
            account_id: "".to_string(),
            org_id: org_id.to_string(),
            project_id: project_id.to_string(),
        };

        let page = params["page"].as_u64().map(|p| p as u32);
        let size = params["size"].as_u64().map(|s| s as u32);

        let pipeline_service = self.client.pipelines();
        let pipelines = pipeline_service
            .list(&scope, page, size)
            .await
            .map_err(|e| ToolError::ToolExecutionFailed {
                tool: "list_pipelines".to_string(),
                params: format!("org_id={}, project_id={}", org_id, project_id),
                reason: e.to_string(),
            })?;

        Ok(serde_json::json!({
            "content": [{
                "type": "text",
                "text": format!("Pipelines:\\n{}",
                    serde_json::to_string_pretty(&pipelines).unwrap_or_default()
                )
            }]
        }))
    }

    pub async fn get_pipeline_executions(&self, params: Value) -> Result<Value> {
        let pipeline_id = params["pipeline_id"]
            .as_str()
            .ok_or_else(|| ToolError::InvalidParameters("Missing pipeline_id".to_string()))?;
        let org_id = params["org_id"]
            .as_str()
            .ok_or_else(|| ToolError::InvalidParameters("Missing org_id".to_string()))?;
        let project_id = params["project_id"]
            .as_str()
            .ok_or_else(|| ToolError::InvalidParameters("Missing project_id".to_string()))?;

        let scope = Scope {
            account_id: "".to_string(),
            org_id: org_id.to_string(),
            project_id: project_id.to_string(),
        };

        let pipeline_service = self.client.pipelines();
        let executions = pipeline_service
            .list_executions(&scope, pipeline_id, None, None)
            .await
            .map_err(|e| ToolError::ToolExecutionFailed {
                tool: "get_pipeline_executions".to_string(),
                params: format!(
                    "pipeline_id={}, org_id={}, project_id={}",
                    pipeline_id, org_id, project_id
                ),
                reason: e.to_string(),
            })?;

        Ok(serde_json::json!({
            "content": [{
                "type": "text",
                "text": format!("Pipeline Executions:\\n{}",
                    serde_json::to_string_pretty(&executions).unwrap_or_default()
                )
            }]
        }))
    }
}
