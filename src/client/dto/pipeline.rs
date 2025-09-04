//! Pipeline DTOs

use serde::{Deserialize, Serialize};

/// Pipeline information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pipeline {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    pub tags: std::collections::HashMap<String, String>,
    pub version: Option<i64>,
}

/// Pipeline execution information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineExecution {
    pub plan_execution_id: String,
    pub status: ExecutionStatus,
    pub start_ts: Option<i64>,
    pub end_ts: Option<i64>,
    pub pipeline_identifier: String,
}

/// Execution status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ExecutionStatus {
    Success,
    Failed,
    Running,
    Aborted,
    Expired,
    Queued,
}

/// Pipeline list response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineListResponse {
    pub status: String,
    pub data: Option<PipelineListData>,
}

/// Pipeline list data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineListData {
    pub content: Vec<Pipeline>,
    pub total_elements: i64,
}

/// Pipeline execution list response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionListResponse {
    pub status: String,
    pub data: Option<ExecutionListData>,
}

/// Execution list data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionListData {
    pub content: Vec<PipelineExecution>,
    pub total_elements: i64,
}