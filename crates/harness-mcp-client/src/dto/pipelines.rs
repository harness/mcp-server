//! Pipeline-related data transfer objects

use super::common::{ListResponse, PaginationOptions, Scope};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Pipeline definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pipeline {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "orgIdentifier")]
    pub org_identifier: String,
    #[serde(rename = "projectIdentifier")]
    pub project_identifier: String,
    pub yaml: Option<String>,
    pub tags: Option<HashMap<String, String>>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<i64>,
    #[serde(rename = "lastModifiedAt")]
    pub last_modified_at: Option<i64>,
}

/// Pipeline execution
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
    #[serde(rename = "runSequence")]
    pub run_sequence: Option<i32>,
}

/// Pipeline list options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineListOptions {
    #[serde(flatten)]
    pub pagination: PaginationOptions,
    pub search_term: Option<String>,
    pub filter_identifier: Option<String>,
}

/// Pipeline execution list options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionListOptions {
    #[serde(flatten)]
    pub pagination: PaginationOptions,
    pub status: Option<Vec<String>>,
    #[serde(rename = "pipelineIdentifier")]
    pub pipeline_identifier: Option<String>,
}

/// Pipeline response wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineResponse {
    pub data: Pipeline,
}

/// Pipeline list response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineListResponse {
    pub data: ListResponse<Pipeline>,
}

/// Execution response wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResponse {
    pub data: PipelineExecution,
}

/// Execution list response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionListResponse {
    pub data: ListResponse<PipelineExecution>,
}