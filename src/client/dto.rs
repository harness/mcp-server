use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Response from the log download API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogDownloadResponse {
    pub link: String,
    pub status: String,
    pub expires: DateTime<Utc>,
}

/// Chat history item for chatbot interactions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatHistoryItem {
    pub question: String,
    pub answer: String,
}

/// Request for chatbot interactions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatRequest {
    pub question: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chat_history: Option<Vec<ChatHistoryItem>>,
}

/// Pagination options for API requests
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginationOptions {
    pub page: u32,
    pub size: u32,
}

impl Default for PaginationOptions {
    fn default() -> Self {
        Self { page: 0, size: 50 }
    }
}

/// Pipeline list options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineListOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub search_term: Option<String>,
    #[serde(flatten)]
    pub pagination: PaginationOptions,
}

/// Execution summary information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionSummaryInfo {
    pub last_execution_status: Option<String>,
    pub last_execution_time: Option<DateTime<Utc>>,
    pub num_of_errors: Option<Vec<String>>,
}

impl ExecutionSummaryInfo {
    /// Format timestamps for display (equivalent to Go's FormatTimestamps method)
    pub fn format_timestamps(&mut self) {
        // In Rust, DateTime<Utc> already handles formatting well
        // This method exists for API compatibility but doesn't need to do anything
        // since Rust's DateTime serialization is already well-formatted
    }
}

/// Pipeline content item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineContent {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    pub tags: Option<HashMap<String, String>>,
    pub execution_summary_info: ExecutionSummaryInfo,
}

/// Pipeline list response data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineListData {
    pub content: Vec<PipelineContent>,
    pub total_elements: u64,
    pub total_pages: u32,
    pub page_index: u32,
    pub page_size: u32,
}

/// Generic API response wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub status: String,
    pub code: String,
    pub message: Option<String>,
    pub correlation_id: Option<String>,
    pub data: T,
}

/// Scope information for API requests
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Scope {
    pub account_id: String,
    pub org_id: Option<String>,
    pub project_id: Option<String>,
}

impl Scope {
    pub fn new(account_id: String) -> Self {
        Self {
            account_id,
            org_id: None,
            project_id: None,
        }
    }

    pub fn with_org(mut self, org_id: String) -> Self {
        self.org_id = Some(org_id);
        self
    }

    pub fn with_project(mut self, project_id: String) -> Self {
        self.project_id = Some(project_id);
        self
    }
}