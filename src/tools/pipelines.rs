use anyhow::Result;
use async_trait::async_trait;
use serde_json::{json, Value};

use crate::config::Config;
use crate::tools::Tool;
use crate::common::Scope;

// Helper functions for parameter extraction
fn get_required_param<T>(arguments: &Value, key: &str) -> Result<T>
where
    T: serde::de::DeserializeOwned,
{
    arguments
        .get(key)
        .ok_or_else(|| anyhow::anyhow!("Missing required parameter: {}", key))?
        .clone()
        .try_into()
        .map_err(|_| anyhow::anyhow!("Invalid type for parameter: {}", key))
}

fn get_optional_param<T>(arguments: &Value, key: &str) -> Result<Option<T>>
where
    T: serde::de::DeserializeOwned,
{
    match arguments.get(key) {
        Some(value) => Ok(Some(
            value
                .clone()
                .try_into()
                .map_err(|_| anyhow::anyhow!("Invalid type for parameter: {}", key))?,
        )),
        None => Ok(None),
    }
}

fn get_scope_from_request(arguments: &Value, config: &Config) -> Result<Scope> {
    let account_id = config.account_id.clone().unwrap_or_default();
    let org_id = get_optional_param::<String>(arguments, "org_id")?
        .or_else(|| config.default_org_id.clone());
    let project_id = get_optional_param::<String>(arguments, "project_id")?
        .or_else(|| config.default_project_id.clone());

    if org_id.is_none() {
        return Err(anyhow::anyhow!("org_id is required"));
    }
    if project_id.is_none() {
        return Err(anyhow::anyhow!("project_id is required"));
    }

    Ok(Scope::project_level(account_id, org_id.unwrap(), project_id.unwrap()))
}

fn get_pagination(arguments: &Value) -> (u64, u64) {
    let page = arguments
        .get("page")
        .and_then(|v| v.as_u64())
        .unwrap_or(0);
    let size = arguments
        .get("size")
        .and_then(|v| v.as_u64())
        .unwrap_or(20);
    (page, size)
}

// Get Pipeline Tool
pub struct GetPipelineTool;

impl GetPipelineTool {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl Tool for GetPipelineTool {
    fn name(&self) -> &str {
        "get_pipeline"
    }

    fn description(&self) -> &str {
        "Get details of a specific pipeline in a Harness repository. Use list_pipelines (if available) first to find the correct pipeline_id if you're unsure of the exact ID."
    }

    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "pipeline_id": {
                    "type": "string",
                    "description": "The ID of the pipeline"
                },
                "org_id": {
                    "type": "string",
                    "description": "Organization ID"
                },
                "project_id": {
                    "type": "string",
                    "description": "Project ID"
                }
            },
            "required": ["pipeline_id"]
        })
    }

    async fn execute(&self, arguments: &Value, config: &Config) -> Result<Value> {
        let pipeline_id: String = get_required_param(arguments, "pipeline_id")?;
        let _scope = get_scope_from_request(arguments, config)?;

        // TODO: Implement actual API call to Harness
        // For now, return mock data
        let result = json!({
            "name": pipeline_id,
            "identifier": pipeline_id,
            "description": format!("Pipeline {}", pipeline_id),
            "tags": {},
            "version": 1,
            "yaml": format!("pipeline:\n  name: {}\n  identifier: {}\n  stages: []", pipeline_id, pipeline_id)
        });

        Ok(json!(serde_json::to_string(&result)?))
    }
}

// List Pipelines Tool
pub struct ListPipelinesTool;

impl ListPipelinesTool {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl Tool for ListPipelinesTool {
    fn name(&self) -> &str {
        "list_pipelines"
    }

    fn description(&self) -> &str {
        "List pipelines in a Harness repository."
    }

    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "search_term": {
                    "type": "string",
                    "description": "Optional search term to filter pipelines"
                },
                "org_id": {
                    "type": "string",
                    "description": "Organization ID"
                },
                "project_id": {
                    "type": "string",
                    "description": "Project ID"
                },
                "page": {
                    "type": "integer",
                    "description": "Page number (default: 0)",
                    "default": 0
                },
                "size": {
                    "type": "integer",
                    "description": "Page size (default: 20)",
                    "default": 20
                }
            }
        })
    }

    async fn execute(&self, arguments: &Value, config: &Config) -> Result<Value> {
        let _scope = get_scope_from_request(arguments, config)?;
        let (page, size) = get_pagination(arguments);
        let search_term: Option<String> = get_optional_param(arguments, "search_term")?;

        // TODO: Implement actual API call to Harness
        // For now, return mock data
        let result = json!({
            "content": [
                {
                    "name": "sample-pipeline",
                    "identifier": "sample_pipeline",
                    "description": "A sample pipeline",
                    "tags": {},
                    "version": 1
                }
            ],
            "pageable": {
                "page": page,
                "size": size
            },
            "totalElements": 1,
            "totalPages": 1
        });

        Ok(json!(serde_json::to_string(&result)?))
    }
}

// Fetch Execution URL Tool
pub struct FetchExecutionURLTool;

impl FetchExecutionURLTool {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl Tool for FetchExecutionURLTool {
    fn name(&self) -> &str {
        "fetch_execution_url"
    }

    fn description(&self) -> &str {
        "Fetch the execution URL for a pipeline execution in Harness."
    }

    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "pipeline_id": {
                    "type": "string",
                    "description": "The ID of the pipeline"
                },
                "plan_execution_id": {
                    "type": "string",
                    "description": "The ID of the plan execution"
                },
                "org_id": {
                    "type": "string",
                    "description": "Organization ID"
                },
                "project_id": {
                    "type": "string",
                    "description": "Project ID"
                }
            },
            "required": ["pipeline_id", "plan_execution_id"]
        })
    }

    async fn execute(&self, arguments: &Value, config: &Config) -> Result<Value> {
        let pipeline_id: String = get_required_param(arguments, "pipeline_id")?;
        let plan_execution_id: String = get_required_param(arguments, "plan_execution_id")?;
        let _scope = get_scope_from_request(arguments, config)?;

        // TODO: Implement actual API call to Harness
        let url = format!("https://app.harness.io/ng/account/{}/cd/orgs/{}/projects/{}/pipelines/{}/executions/{}/pipeline",
            config.account_id.as_deref().unwrap_or(""),
            config.default_org_id.as_deref().unwrap_or(""),
            config.default_project_id.as_deref().unwrap_or(""),
            pipeline_id,
            plan_execution_id
        );

        Ok(json!(url))
    }
}

// Get Execution Tool
pub struct GetExecutionTool;

impl GetExecutionTool {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl Tool for GetExecutionTool {
    fn name(&self) -> &str {
        "get_execution"
    }

    fn description(&self) -> &str {
        "Get details of a specific pipeline execution in Harness."
    }

    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "plan_execution_id": {
                    "type": "string",
                    "description": "The ID of the plan execution"
                },
                "org_id": {
                    "type": "string",
                    "description": "Organization ID"
                },
                "project_id": {
                    "type": "string",
                    "description": "Project ID"
                }
            },
            "required": ["plan_execution_id"]
        })
    }

    async fn execute(&self, arguments: &Value, config: &Config) -> Result<Value> {
        let plan_execution_id: String = get_required_param(arguments, "plan_execution_id")?;
        let _scope = get_scope_from_request(arguments, config)?;

        // TODO: Implement actual API call to Harness
        let result = json!({
            "planExecutionId": plan_execution_id,
            "status": "Success",
            "startTs": 1640995200000i64,
            "endTs": 1640995800000i64,
            "executionTriggerInfo": {
                "triggerType": "MANUAL"
            }
        });

        Ok(json!(serde_json::to_string(&result)?))
    }
}

// List Executions Tool
pub struct ListExecutionsTool;

impl ListExecutionsTool {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl Tool for ListExecutionsTool {
    fn name(&self) -> &str {
        "list_executions"
    }

    fn description(&self) -> &str {
        "List pipeline executions in a Harness repository."
    }

    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "search_term": {
                    "type": "string",
                    "description": "Optional search term to filter executions"
                },
                "pipeline_identifier": {
                    "type": "string",
                    "description": "Optional pipeline identifier to filter executions"
                },
                "status": {
                    "type": "string",
                    "description": "Optional status to filter executions (e.g., Running, Success, Failed)"
                },
                "branch": {
                    "type": "string",
                    "description": "Optional branch to filter executions"
                },
                "my_deployments": {
                    "type": "boolean",
                    "description": "Optional flag to show only my deployments"
                },
                "org_id": {
                    "type": "string",
                    "description": "Organization ID"
                },
                "project_id": {
                    "type": "string",
                    "description": "Project ID"
                },
                "page": {
                    "type": "integer",
                    "description": "Page number (default: 0)",
                    "default": 0
                },
                "size": {
                    "type": "integer",
                    "description": "Page size (default: 20)",
                    "default": 20
                }
            }
        })
    }

    async fn execute(&self, arguments: &Value, config: &Config) -> Result<Value> {
        let _scope = get_scope_from_request(arguments, config)?;
        let (page, size) = get_pagination(arguments);
        let _search_term: Option<String> = get_optional_param(arguments, "search_term")?;
        let _pipeline_identifier: Option<String> = get_optional_param(arguments, "pipeline_identifier")?;
        let _status: Option<String> = get_optional_param(arguments, "status")?;
        let _branch: Option<String> = get_optional_param(arguments, "branch")?;
        let _my_deployments: Option<bool> = get_optional_param(arguments, "my_deployments")?;

        // TODO: Implement actual API call to Harness
        let result = json!({
            "content": [
                {
                    "planExecutionId": "exec_123",
                    "pipelineIdentifier": "sample_pipeline",
                    "status": "Success",
                    "startTs": 1640995200000i64,
                    "endTs": 1640995800000i64
                }
            ],
            "pageable": {
                "page": page,
                "size": size
            },
            "totalElements": 1,
            "totalPages": 1
        });

        Ok(json!(serde_json::to_string(&result)?))
    }
}

// Get Pipeline Summary Tool
pub struct GetPipelineSummaryTool;

impl GetPipelineSummaryTool {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl Tool for GetPipelineSummaryTool {
    fn name(&self) -> &str {
        "get_pipeline_summary"
    }

    fn description(&self) -> &str {
        "Provides a concise summary of a pipeline's overall structure and execution info highlighting key aspects rather than detailed pipeline definition such as pipeline yaml, external references, etc."
    }

    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "pipeline_id": {
                    "type": "string",
                    "description": "Identifier of the pipeline."
                },
                "get_metadata_only": {
                    "type": "boolean",
                    "description": "Whether to only fetch metadata without full pipeline details."
                },
                "org_id": {
                    "type": "string",
                    "description": "Organization ID"
                },
                "project_id": {
                    "type": "string",
                    "description": "Project ID"
                }
            },
            "required": ["pipeline_id"]
        })
    }

    async fn execute(&self, arguments: &Value, config: &Config) -> Result<Value> {
        let pipeline_id: String = get_required_param(arguments, "pipeline_id")?;
        let _get_metadata_only: Option<bool> = get_optional_param(arguments, "get_metadata_only")?;
        let _scope = get_scope_from_request(arguments, config)?;

        // TODO: Implement actual API call to Harness
        let result = json!({
            "identifier": pipeline_id,
            "name": format!("Pipeline {}", pipeline_id),
            "description": "Pipeline summary",
            "stageCount": 3,
            "lastExecutionStatus": "Success",
            "lastExecutionTime": 1640995800000i64
        });

        Ok(json!(serde_json::to_string(&result)?))
    }
}