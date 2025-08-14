use crate::{ToolError, params::ToolRequest};
use harness_client::{HarnessClient, pipeline::PipelineClient};
use harness_config::Config;
use serde_json::Value;
use std::sync::Arc;
use tracing::{debug, error};

/// Pipeline tools implementation
/// Migrated from Go pipeline tools
pub struct PipelineTools {
    client: PipelineClient,
    config: Arc<Config>,
}

impl PipelineTools {
    /// Create new pipeline tools
    pub fn new(client: HarnessClient, config: Arc<Config>) -> Self {
        let pipeline_client = PipelineClient::new(client);
        Self {
            client: pipeline_client,
            config,
        }
    }

    /// List pipelines tool
    pub async fn list_pipelines(&self, request: &ToolRequest) -> Result<Value, ToolError> {
        use crate::params::{optional_param, optional_int_param};

        let org_id: Option<String> = optional_param(request, "org_id")?
            .or_else(|| self.config.default_org_id.clone());
        let project_id: Option<String> = optional_param(request, "project_id")?
            .or_else(|| self.config.default_project_id.clone());
        let page: Option<i32> = optional_int_param(request, "page")?;
        let size: Option<i32> = optional_int_param(request, "size")?;

        debug!("Listing pipelines for account: {}", self.config.account_id);

        match self.client.list_pipelines(
            &self.config.account_id,
            org_id.as_deref(),
            project_id.as_deref(),
            page,
            size,
        ).await {
            Ok(response) => {
                Ok(serde_json::json!({
                    "pipelines": response.content,
                    "page_info": response.page_info,
                    "total_count": response.content.len()
                }))
            }
            Err(e) => {
                error!("Failed to list pipelines: {}", e);
                Err(ToolError::ExecutionFailed {
                    message: format!("Failed to list pipelines: {}", e),
                })
            }
        }
    }

    /// Get pipeline details tool
    pub async fn get_pipeline(&self, request: &ToolRequest) -> Result<Value, ToolError> {
        use crate::params::{required_param, optional_param};

        let pipeline_id: String = required_param(request, "pipeline_id")?;
        let org_id: String = optional_param(request, "org_id")?
            .or_else(|| self.config.default_org_id.clone())
            .ok_or_else(|| ToolError::InvalidArguments {
                message: "org_id is required".to_string(),
            })?;
        let project_id: String = optional_param(request, "project_id")?
            .or_else(|| self.config.default_project_id.clone())
            .ok_or_else(|| ToolError::InvalidArguments {
                message: "project_id is required".to_string(),
            })?;

        debug!("Getting pipeline: {} in org: {}, project: {}", pipeline_id, org_id, project_id);

        match self.client.get_pipeline(
            &self.config.account_id,
            &org_id,
            &project_id,
            &pipeline_id,
        ).await {
            Ok(pipeline) => {
                Ok(serde_json::to_value(pipeline).map_err(|e| ToolError::ExecutionFailed {
                    message: format!("Failed to serialize pipeline: {}", e),
                })?)
            }
            Err(e) => {
                error!("Failed to get pipeline: {}", e);
                Err(ToolError::ExecutionFailed {
                    message: format!("Failed to get pipeline: {}", e),
                })
            }
        }
    }

    /// List pipeline executions tool
    pub async fn list_executions(&self, request: &ToolRequest) -> Result<Value, ToolError> {
        use crate::params::{required_param, optional_param, optional_int_param};

        let pipeline_id: String = required_param(request, "pipeline_id")?;
        let org_id: String = optional_param(request, "org_id")?
            .or_else(|| self.config.default_org_id.clone())
            .ok_or_else(|| ToolError::InvalidArguments {
                message: "org_id is required".to_string(),
            })?;
        let project_id: String = optional_param(request, "project_id")?
            .or_else(|| self.config.default_project_id.clone())
            .ok_or_else(|| ToolError::InvalidArguments {
                message: "project_id is required".to_string(),
            })?;
        let page: Option<i32> = optional_int_param(request, "page")?;
        let size: Option<i32> = optional_int_param(request, "size")?;

        debug!("Listing executions for pipeline: {}", pipeline_id);

        match self.client.list_executions(
            &self.config.account_id,
            &org_id,
            &project_id,
            &pipeline_id,
            page,
            size,
        ).await {
            Ok(response) => {
                Ok(serde_json::json!({
                    "executions": response.content,
                    "page_info": response.page_info,
                    "total_count": response.content.len()
                }))
            }
            Err(e) => {
                error!("Failed to list executions: {}", e);
                Err(ToolError::ExecutionFailed {
                    message: format!("Failed to list executions: {}", e),
                })
            }
        }
    }

    /// Get execution details tool
    pub async fn get_execution(&self, request: &ToolRequest) -> Result<Value, ToolError> {
        use crate::params::{required_param, optional_param};

        let pipeline_id: String = required_param(request, "pipeline_id")?;
        let execution_id: String = required_param(request, "execution_id")?;
        let org_id: String = optional_param(request, "org_id")?
            .or_else(|| self.config.default_org_id.clone())
            .ok_or_else(|| ToolError::InvalidArguments {
                message: "org_id is required".to_string(),
            })?;
        let project_id: String = optional_param(request, "project_id")?
            .or_else(|| self.config.default_project_id.clone())
            .ok_or_else(|| ToolError::InvalidArguments {
                message: "project_id is required".to_string(),
            })?;

        debug!("Getting execution: {} for pipeline: {}", execution_id, pipeline_id);

        match self.client.get_execution(
            &self.config.account_id,
            &org_id,
            &project_id,
            &pipeline_id,
            &execution_id,
        ).await {
            Ok(execution) => {
                Ok(serde_json::to_value(execution).map_err(|e| ToolError::ExecutionFailed {
                    message: format!("Failed to serialize execution: {}", e),
                })?)
            }
            Err(e) => {
                error!("Failed to get execution: {}", e);
                Err(ToolError::ExecutionFailed {
                    message: format!("Failed to get execution: {}", e),
                })
            }
        }
    }

    /// Fetch execution URL tool
    pub async fn fetch_execution_url(&self, request: &ToolRequest) -> Result<Value, ToolError> {
        use crate::params::{required_param, optional_param};

        let pipeline_id: String = required_param(request, "pipeline_id")?;
        let execution_id: String = required_param(request, "execution_id")?;
        let org_id: String = optional_param(request, "org_id")?
            .or_else(|| self.config.default_org_id.clone())
            .ok_or_else(|| ToolError::InvalidArguments {
                message: "org_id is required".to_string(),
            })?;
        let project_id: String = optional_param(request, "project_id")?
            .or_else(|| self.config.default_project_id.clone())
            .ok_or_else(|| ToolError::InvalidArguments {
                message: "project_id is required".to_string(),
            })?;

        // Construct execution URL
        let execution_url = format!(
            "{}/ng/account/{}/cd/orgs/{}/projects/{}/pipelines/{}/executions/{}",
            self.config.base_url,
            self.config.account_id,
            org_id,
            project_id,
            pipeline_id,
            execution_id
        );

        Ok(serde_json::json!({
            "execution_url": execution_url,
            "pipeline_id": pipeline_id,
            "execution_id": execution_id
        }))
    }
}