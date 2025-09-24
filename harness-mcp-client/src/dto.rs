use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Scope {
    pub account_id: String,
    pub org_id: Option<String>,
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginatedResponse<T> {
    pub data: Vec<T>,
    pub page: u32,
    pub size: u32,
    pub total: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineListOptions {
    pub page: Option<u32>,
    pub size: Option<u32>,
    pub search_term: Option<String>,
}

impl Default for PipelineListOptions {
    fn default() -> Self {
        Self {
            page: Some(0),
            size: Some(5),
            search_term: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pipeline {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    pub tags: Option<std::collections::HashMap<String, String>>,
    pub version: Option<i64>,
    pub created: Option<DateTime<Utc>>,
    pub updated: Option<DateTime<Utc>>,
    pub yaml: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineExecution {
    pub plan_execution_id: String,
    pub pipeline_identifier: String,
    pub status: String,
    pub created: Option<DateTime<Utc>>,
    pub started: Option<DateTime<Utc>>,
    pub ended: Option<DateTime<Utc>>,
    pub trigger_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Connector {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    pub tags: Option<std::collections::HashMap<String, String>>,
    pub connector_type: String,
    pub created: Option<DateTime<Utc>>,
    pub updated: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Service {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    pub tags: Option<std::collections::HashMap<String, String>>,
    pub created: Option<DateTime<Utc>>,
    pub updated: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Environment {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    pub tags: Option<std::collections::HashMap<String, String>>,
    pub environment_type: String,
    pub created: Option<DateTime<Utc>>,
    pub updated: Option<DateTime<Utc>>,
}

// Add more DTOs as needed for other Harness entities...