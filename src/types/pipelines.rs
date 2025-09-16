use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::types::common::{GitDetails, EntityValidityDetails, unix_millis_to_rfc3339};

/// Generic entity wrapper for API responses
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entity<T> {
    pub status: String,
    pub data: T,
}

/// Pipeline data structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineData {
    #[serde(rename = "yamlPipeline", skip_serializing_if = "Option::is_none")]
    pub yaml_pipeline: Option<String>,
    #[serde(rename = "resolvedTemplatesPipelineYaml", skip_serializing_if = "Option::is_none")]
    pub resolved_templates_pipeline_yaml: Option<String>,
    #[serde(rename = "gitDetails", skip_serializing_if = "Option::is_none")]
    pub git_details: Option<GitDetails>,
    #[serde(rename = "entityValidityDetails", skip_serializing_if = "Option::is_none")]
    pub entity_validity_details: Option<EntityValidityDetails>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub modules: Option<Vec<String>>,
    #[serde(rename = "storeType", skip_serializing_if = "Option::is_none")]
    pub store_type: Option<String>,
    #[serde(rename = "connectorRef", skip_serializing_if = "Option::is_none")]
    pub connector_ref: Option<String>,
    #[serde(rename = "allowDynamicExecutions", skip_serializing_if = "Option::is_none")]
    pub allow_dynamic_executions: Option<bool>,
    #[serde(rename = "isInlineHCEntity", skip_serializing_if = "Option::is_none")]
    pub is_inline_hc_entity: Option<bool>,
}

/// Generic list output structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListOutput<T> {
    pub status: String,
    pub data: ListOutputData<T>,
}

/// List output data structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListOutputData<T> {
    #[serde(rename = "totalElements", skip_serializing_if = "Option::is_none")]
    pub total_elements: Option<i32>,
    #[serde(rename = "totalItems", skip_serializing_if = "Option::is_none")]
    pub total_items: Option<i32>,
    #[serde(rename = "totalPages", skip_serializing_if = "Option::is_none")]
    pub total_pages: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<i32>,
    #[serde(rename = "pageSize", skip_serializing_if = "Option::is_none")]
    pub page_size: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<Vec<T>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub number: Option<i32>,
    #[serde(rename = "pageIndex", skip_serializing_if = "Option::is_none")]
    pub page_index: Option<i32>,
    #[serde(rename = "pageItemCount", skip_serializing_if = "Option::is_none")]
    pub page_item_count: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sort: Option<SortInfo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub first: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pageable: Option<PageableInfo>,
    #[serde(rename = "numberOfElements", skip_serializing_if = "Option::is_none")]
    pub number_of_elements: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub empty: Option<bool>,
}

/// Pagination options
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PaginationOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<i32>,
}

/// Pipeline list options
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PipelineListOptions {
    #[serde(flatten)]
    pub pagination: PaginationOptions,
    #[serde(rename = "searchTerm", skip_serializing_if = "Option::is_none")]
    pub search_term: Option<String>,
}

/// Pipeline summary
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
    #[serde(rename = "executionSummaryInfo", skip_serializing_if = "Option::is_none")]
    pub execution_summary_info: Option<ExecutionSummaryInfo>,
    #[serde(rename = "stageNames", skip_serializing_if = "Option::is_none")]
    pub stage_names: Option<Vec<String>>,
    #[serde(rename = "yamlVersion", skip_serializing_if = "Option::is_none")]
    pub yaml_version: Option<String>,
}

/// Pipeline list item
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
    #[serde(rename = "executionSummaryInfo", skip_serializing_if = "Option::is_none")]
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

/// Execution summary information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionSummaryInfo {
    #[serde(rename = "numOfErrors", skip_serializing_if = "Option::is_none")]
    pub num_of_errors: Option<Vec<i32>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deployments: Option<Vec<i32>>,
    #[serde(rename = "lastExecutionTs", skip_serializing_if = "Option::is_none")]
    pub last_execution_ts: Option<i64>,
    #[serde(rename = "lastExecutionStatus", skip_serializing_if = "Option::is_none")]
    pub last_execution_status: Option<String>,
    #[serde(rename = "lastExecutionId", skip_serializing_if = "Option::is_none")]
    pub last_execution_id: Option<String>,
}

/// Sort information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SortInfo {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub empty: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unsorted: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sorted: Option<bool>,
}

/// Pageable information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageableInfo {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub offset: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sort: Option<SortInfo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub paged: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unpaged: Option<bool>,
    #[serde(rename = "pageSize", skip_serializing_if = "Option::is_none")]
    pub page_size: Option<i32>,
    #[serde(rename = "pageNumber", skip_serializing_if = "Option::is_none")]
    pub page_number: Option<i32>,
}

/// Pipeline tag for filtering
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineTag {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<String>,
}

/// Pipeline execution options
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PipelineExecutionOptions {
    #[serde(flatten)]
    pub pagination: PaginationOptions,
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

/// Pipeline execution response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineExecutionResponse {
    #[serde(rename = "pipelineExecutionSummary", skip_serializing_if = "Option::is_none")]
    pub pipeline_execution_summary: Option<PipelineExecution>,
}

/// Pipeline execution
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
    #[serde(rename = "successfulStagesCount", skip_serializing_if = "Option::is_none")]
    pub successful_stages_count: Option<i32>,
    #[serde(rename = "failedStagesCount", skip_serializing_if = "Option::is_none")]
    pub failed_stages_count: Option<i32>,
    #[serde(rename = "runningStagesCount", skip_serializing_if = "Option::is_none")]
    pub running_stages_count: Option<i32>,
    #[serde(rename = "totalStagesRunningCount", skip_serializing_if = "Option::is_none")]
    pub total_stages_running_count: Option<i32>,
    #[serde(rename = "stagesExecuted", skip_serializing_if = "Option::is_none")]
    pub stages_executed: Option<Vec<String>>,
    #[serde(rename = "abortedBy", skip_serializing_if = "Option::is_none")]
    pub aborted_by: Option<User>,
    #[serde(rename = "queuedType", skip_serializing_if = "Option::is_none")]
    pub queued_type: Option<String>,
    #[serde(rename = "runSequence", skip_serializing_if = "Option::is_none")]
    pub run_sequence: Option<i32>,
    #[serde(rename = "shouldUseSimplifiedKey", skip_serializing_if = "Option::is_none")]
    pub should_use_simplified_base_key: Option<bool>,
}

/// Execution failure information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionFailureInfo {
    #[serde(rename = "failureTypeList", skip_serializing_if = "Option::is_none")]
    pub failure_type_list: Option<Vec<String>>,
    #[serde(rename = "responseMessages", skip_serializing_if = "Option::is_none")]
    pub response_messages: Option<Vec<ExecutionResponseMessage>>,
}

/// Execution response message
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

/// Execution exception
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionException {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

/// User information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(rename = "userName", skip_serializing_if = "Option::is_none")]
    pub user_name: Option<String>,
    #[serde(rename = "createdAt", skip_serializing_if = "Option::is_none")]
    pub created_at: Option<i64>,
}

impl PipelineSummary {
    /// Get human-readable created at time
    pub fn created_at_time(&self) -> Option<String> {
        self.created_at.and_then(unix_millis_to_rfc3339)
    }

    /// Get human-readable last updated time
    pub fn last_updated_at_time(&self) -> Option<String> {
        self.last_updated_at.and_then(unix_millis_to_rfc3339)
    }
}

impl PipelineListItem {
    /// Get human-readable created at time
    pub fn created_at_time(&self) -> Option<String> {
        self.created_at.and_then(unix_millis_to_rfc3339)
    }

    /// Get human-readable last updated time
    pub fn last_updated_at_time(&self) -> Option<String> {
        self.last_updated_at.and_then(unix_millis_to_rfc3339)
    }
}

impl PipelineExecution {
    /// Get human-readable start time
    pub fn start_time(&self) -> Option<String> {
        self.start_ts.and_then(unix_millis_to_rfc3339)
    }

    /// Get human-readable end time
    pub fn end_time(&self) -> Option<String> {
        self.end_ts.and_then(unix_millis_to_rfc3339)
    }

    /// Get human-readable created at time
    pub fn created_at_time(&self) -> Option<String> {
        self.created_at.and_then(unix_millis_to_rfc3339)
    }

    /// Calculate execution duration in seconds
    pub fn duration_seconds(&self) -> Option<i64> {
        match (self.start_ts, self.end_ts) {
            (Some(start), Some(end)) => Some((end - start) / 1000),
            _ => None,
        }
    }
}