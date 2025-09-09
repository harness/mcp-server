use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

// Pipeline data structures
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineData {
    #[serde(rename = "yamlPipeline", skip_serializing_if = "Option::is_none")]
    pub yaml_pipeline: Option<String>,
    #[serde(
        rename = "resolvedTemplatesPipelineYaml",
        skip_serializing_if = "Option::is_none"
    )]
    pub resolved_templates_pipeline_yaml: Option<String>,
    #[serde(rename = "gitDetails", skip_serializing_if = "Option::is_none")]
    pub git_details: Option<crate::common::GitDetails>,
    #[serde(
        rename = "entityValidityDetails",
        skip_serializing_if = "Option::is_none"
    )]
    pub entity_validity_details: Option<crate::common::EntityValidityDetails>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub modules: Option<Vec<String>>,
    #[serde(rename = "storeType", skip_serializing_if = "Option::is_none")]
    pub store_type: Option<String>,
    #[serde(rename = "connectorRef", skip_serializing_if = "Option::is_none")]
    pub connector_ref: Option<String>,
    #[serde(
        rename = "allowDynamicExecutions",
        skip_serializing_if = "Option::is_none"
    )]
    pub allow_dynamic_executions: Option<bool>,
    #[serde(rename = "isInlineHCEntity", skip_serializing_if = "Option::is_none")]
    pub is_inline_hc_entity: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineListOptions {
    #[serde(flatten)]
    pub pagination: crate::common::PaginationOptions,
    #[serde(rename = "searchTerm", skip_serializing_if = "Option::is_none")]
    pub search_term: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineSummary {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub identifier: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<HashMap<String, String>>,
    #[serde(rename = "orgIdentifier", skip_serializing_if = "Option::is_none")]
    pub org_identifier: Option<String>,
    #[serde(rename = "projectIdentifier", skip_serializing_if = "Option::is_none")]
    pub project_identifier: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<i32>,
    #[serde(rename = "numOfStages", skip_serializing_if = "Option::is_none")]
    pub num_of_stages: Option<i32>,
    #[serde(rename = "createdAt", skip_serializing_if = "Option::is_none")]
    pub created_at: Option<i64>,
    #[serde(rename = "lastUpdatedAt", skip_serializing_if = "Option::is_none")]
    pub last_updated_at: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub modules: Option<Vec<String>>,
    #[serde(
        rename = "executionSummaryInfo",
        skip_serializing_if = "Option::is_none"
    )]
    pub execution_summary_info: Option<ExecutionSummaryInfo>,
    #[serde(rename = "stageNames", skip_serializing_if = "Option::is_none")]
    pub stage_names: Option<Vec<String>>,
    #[serde(rename = "yamlVersion", skip_serializing_if = "Option::is_none")]
    pub yaml_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineListItem {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub identifier: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<HashMap<String, String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<i32>,
    #[serde(rename = "numOfStages", skip_serializing_if = "Option::is_none")]
    pub num_of_stages: Option<i32>,
    #[serde(rename = "createdAt", skip_serializing_if = "Option::is_none")]
    pub created_at: Option<i64>,
    #[serde(rename = "lastUpdatedAt", skip_serializing_if = "Option::is_none")]
    pub last_updated_at: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub modules: Option<Vec<String>>,
    #[serde(
        rename = "executionSummaryInfo",
        skip_serializing_if = "Option::is_none"
    )]
    pub execution_summary_info: Option<ExecutionSummaryInfo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filters: Option<HashMap<String, serde_json::Value>>,
    #[serde(rename = "stageNames", skip_serializing_if = "Option::is_none")]
    pub stage_names: Option<Vec<String>>,
    #[serde(rename = "storeType", skip_serializing_if = "Option::is_none")]
    pub store_type: Option<String>,
    #[serde(rename = "connectorRef", skip_serializing_if = "Option::is_none")]
    pub connector_ref: Option<String>,
    #[serde(rename = "isDraft", skip_serializing_if = "Option::is_none")]
    pub is_draft: Option<bool>,
    #[serde(rename = "yamlVersion", skip_serializing_if = "Option::is_none")]
    pub yaml_version: Option<String>,
    #[serde(rename = "isInlineHCEntity", skip_serializing_if = "Option::is_none")]
    pub is_inline_hc_entity: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionSummaryInfo {
    #[serde(rename = "numOfErrors", skip_serializing_if = "Option::is_none")]
    pub num_of_errors: Option<Vec<i32>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deployments: Option<Vec<i32>>,
    #[serde(rename = "lastExecutionTs", skip_serializing_if = "Option::is_none")]
    pub last_execution_ts: Option<i64>,
    #[serde(
        rename = "lastExecutionStatus",
        skip_serializing_if = "Option::is_none"
    )]
    pub last_execution_status: Option<String>,
    #[serde(rename = "lastExecutionId", skip_serializing_if = "Option::is_none")]
    pub last_execution_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineTag {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineExecutionOptions {
    #[serde(flatten)]
    pub pagination: crate::common::PaginationOptions,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(rename = "myDeployments", skip_serializing_if = "Option::is_none")]
    pub my_deployments: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub branch: Option<String>,
    #[serde(rename = "searchTerm", skip_serializing_if = "Option::is_none")]
    pub search_term: Option<String>,
    #[serde(rename = "pipelineIdentifier", skip_serializing_if = "Option::is_none")]
    pub pipeline_identifier: Option<String>,
    #[serde(rename = "pipelineTags", skip_serializing_if = "Option::is_none")]
    pub pipeline_tags: Option<Vec<PipelineTag>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineExecutionResponse {
    #[serde(
        rename = "pipelineExecutionSummary",
        skip_serializing_if = "Option::is_none"
    )]
    pub pipeline_execution_summary: Option<PipelineExecution>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineExecution {
    #[serde(rename = "pipelineIdentifier", skip_serializing_if = "Option::is_none")]
    pub pipeline_identifier: Option<String>,
    #[serde(rename = "projectIdentifier", skip_serializing_if = "Option::is_none")]
    pub project_identifier: Option<String>,
    #[serde(rename = "orgIdentifier", skip_serializing_if = "Option::is_none")]
    pub org_identifier: Option<String>,
    #[serde(rename = "planExecutionId", skip_serializing_if = "Option::is_none")]
    pub plan_execution_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(rename = "failureInfo", skip_serializing_if = "Option::is_none")]
    pub failure_info: Option<ExecutionFailureInfo>,
    #[serde(rename = "startTs", skip_serializing_if = "Option::is_none")]
    pub start_ts: Option<i64>,
    #[serde(rename = "endTs", skip_serializing_if = "Option::is_none")]
    pub end_ts: Option<i64>,
    #[serde(rename = "createdAt", skip_serializing_if = "Option::is_none")]
    pub created_at: Option<i64>,
    #[serde(rename = "connectorRef", skip_serializing_if = "Option::is_none")]
    pub connector_ref: Option<String>,
    #[serde(
        rename = "successfulStagesCount",
        skip_serializing_if = "Option::is_none"
    )]
    pub successful_stages_count: Option<i32>,
    #[serde(rename = "failedStagesCount", skip_serializing_if = "Option::is_none")]
    pub failed_stages_count: Option<i32>,
    #[serde(rename = "runningStagesCount", skip_serializing_if = "Option::is_none")]
    pub running_stages_count: Option<i32>,
    #[serde(
        rename = "totalStagesRunningCount",
        skip_serializing_if = "Option::is_none"
    )]
    pub total_stages_running_count: Option<i32>,
    #[serde(rename = "stagesExecuted", skip_serializing_if = "Option::is_none")]
    pub stages_executed: Option<Vec<String>>,
    #[serde(rename = "abortedBy", skip_serializing_if = "Option::is_none")]
    pub aborted_by: Option<crate::common::User>,
    #[serde(rename = "queuedType", skip_serializing_if = "Option::is_none")]
    pub queued_type: Option<String>,
    #[serde(rename = "runSequence", skip_serializing_if = "Option::is_none")]
    pub run_sequence: Option<i32>,
    #[serde(
        rename = "shouldUseSimplifiedBaseKey",
        skip_serializing_if = "Option::is_none"
    )]
    pub should_use_simplified_base_key: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionFailureInfo {
    #[serde(rename = "failureTypeList", skip_serializing_if = "Option::is_none")]
    pub failure_type_list: Option<Vec<String>>,
    #[serde(rename = "responseMessages", skip_serializing_if = "Option::is_none")]
    pub response_messages: Option<Vec<ExecutionResponseMessage>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResponseMessage {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub level: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exception: Option<ExecutionException>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionException {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionTriggerInfo {
    #[serde(rename = "triggerType", skip_serializing_if = "Option::is_none")]
    pub trigger_type: Option<String>,
    #[serde(rename = "triggeredBy", skip_serializing_if = "Option::is_none")]
    pub triggered_by: Option<TriggeredBy>,
    #[serde(rename = "isRerun", skip_serializing_if = "Option::is_none")]
    pub is_rerun: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TriggeredBy {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uuid: Option<Uuid>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub identifier: Option<String>,
    #[serde(rename = "extraInfo", skip_serializing_if = "Option::is_none")]
    pub extra_info: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionTag {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GovernanceMetadata {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deny: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<Vec<GovernanceDetail>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GovernanceDetail {
    #[serde(rename = "policyId", skip_serializing_if = "Option::is_none")]
    pub policy_id: Option<String>,
    #[serde(rename = "policyName", skip_serializing_if = "Option::is_none")]
    pub policy_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deny: Option<bool>,
}

// Type aliases for backward compatibility
pub type Pipeline = PipelineData;
