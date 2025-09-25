use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use super::common::{EntityMetadata, GitDetails, EntityValidityDetails};

/// Pipeline summary information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineSummary {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    pub tags: Option<HashMap<String, String>>,
    #[serde(rename = "orgIdentifier")]
    pub org_identifier: String,
    #[serde(rename = "projectIdentifier")]
    pub project_identifier: String,
    pub version: Option<i32>,
    #[serde(rename = "numOfStages")]
    pub num_of_stages: Option<i32>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<i64>,
    #[serde(rename = "lastUpdatedAt")]
    pub last_updated_at: Option<i64>,
    pub modules: Option<Vec<String>>,
    #[serde(rename = "executionSummaryInfo")]
    pub execution_summary_info: Option<ExecutionSummaryInfo>,
    #[serde(rename = "stageNames")]
    pub stage_names: Option<Vec<String>>,
    #[serde(rename = "yamlVersion")]
    pub yaml_version: Option<String>,
}

/// Pipeline execution summary
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionSummaryInfo {
    #[serde(rename = "lastExecutionTs")]
    pub last_execution_ts: Option<i64>,
    #[serde(rename = "lastExecutionStatus")]
    pub last_execution_status: Option<String>,
    #[serde(rename = "lastExecutionId")]
    pub last_execution_id: Option<String>,
    #[serde(rename = "numOfErrors")]
    pub num_of_errors: Option<Vec<i32>>,
    pub deployments: Option<Vec<i32>>,
}

/// Pipeline data structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineData {
    #[serde(rename = "yamlPipeline")]
    pub yaml_pipeline: Option<String>,
    #[serde(rename = "resolvedTemplatesPipelineYaml")]
    pub resolved_templates_pipeline_yaml: Option<String>,
    #[serde(rename = "gitDetails")]
    pub git_details: Option<GitDetails>,
    #[serde(rename = "entityValidityDetails")]
    pub entity_validity_details: Option<EntityValidityDetails>,
    pub modules: Option<Vec<String>>,
    #[serde(rename = "storeType")]
    pub store_type: Option<String>,
    #[serde(rename = "connectorRef")]
    pub connector_ref: Option<String>,
    #[serde(rename = "allowDynamicExecutions")]
    pub allow_dynamic_executions: Option<bool>,
    #[serde(rename = "isInlineHCEntity")]
    pub is_inline_hc_entity: Option<bool>,
}

/// Pipeline execution details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineExecution {
    #[serde(rename = "planExecutionId")]
    pub plan_execution_id: String,
    #[serde(rename = "pipelineIdentifier")]
    pub pipeline_identifier: String,
    pub status: String,
    #[serde(rename = "startTs")]
    pub start_ts: Option<i64>,
    #[serde(rename = "endTs")]
    pub end_ts: Option<i64>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<i64>,
    #[serde(rename = "runSequence")]
    pub run_sequence: Option<i32>,
    #[serde(rename = "executionTriggerInfo")]
    pub execution_trigger_info: Option<ExecutionTriggerInfo>,
    #[serde(rename = "moduleInfo")]
    pub module_info: Option<HashMap<String, serde_json::Value>>,
}

/// Execution trigger information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionTriggerInfo {
    #[serde(rename = "triggerType")]
    pub trigger_type: Option<String>,
    #[serde(rename = "triggeredBy")]
    pub triggered_by: Option<TriggeredBy>,
}

/// Information about who triggered the execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TriggeredBy {
    pub uuid: Option<String>,
    pub identifier: Option<String>,
    #[serde(rename = "extraInfo")]
    pub extra_info: Option<HashMap<String, String>>,
}