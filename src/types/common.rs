use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use chrono::{DateTime, Utc};

/// Common scope parameters used across Harness APIs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Scope {
    #[serde(rename = "accountIdentifier")]
    pub account_identifier: String,
    #[serde(rename = "orgIdentifier", skip_serializing_if = "Option::is_none")]
    pub org_identifier: Option<String>,
    #[serde(rename = "projectIdentifier", skip_serializing_if = "Option::is_none")]
    pub project_identifier: Option<String>,
}

/// Standard Harness API response wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HarnessResponse<T> {
    pub status: String,
    pub data: Option<T>,
    #[serde(rename = "metaData", skip_serializing_if = "Option::is_none")]
    pub meta_data: Option<serde_json::Value>,
    #[serde(rename = "correlationId", skip_serializing_if = "Option::is_none")]
    pub correlation_id: Option<String>,
}

/// Pagination information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageInfo {
    pub page: Option<i32>,
    pub size: Option<i32>,
    pub total: Option<i64>,
    #[serde(rename = "totalPages", skip_serializing_if = "Option::is_none")]
    pub total_pages: Option<i32>,
}

/// Paginated response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PagedResponse<T> {
    pub content: Vec<T>,
    #[serde(rename = "pageInfo", skip_serializing_if = "Option::is_none")]
    pub page_info: Option<PageInfo>,
}

/// Git details for entities stored in Git
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitDetails {
    pub valid: bool,
    #[serde(rename = "invalidYaml", skip_serializing_if = "Option::is_none")]
    pub invalid_yaml: Option<String>,
    #[serde(rename = "repoIdentifier", skip_serializing_if = "Option::is_none")]
    pub repo_identifier: Option<String>,
    #[serde(rename = "filePath", skip_serializing_if = "Option::is_none")]
    pub file_path: Option<String>,
    #[serde(rename = "branch", skip_serializing_if = "Option::is_none")]
    pub branch: Option<String>,
}

/// Entity validity details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityValidityDetails {
    pub valid: bool,
    #[serde(rename = "invalidYaml", skip_serializing_if = "Option::is_none")]
    pub invalid_yaml: Option<String>,
}

/// Standard error response from Harness APIs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HarnessError {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

/// Filter criteria for list operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilterCriteria {
    #[serde(rename = "filterType", skip_serializing_if = "Option::is_none")]
    pub filter_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<HashMap<String, String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub search_term: Option<String>,
}

/// Utility function to convert Unix timestamp in milliseconds to DateTime
pub fn unix_millis_to_datetime(millis: i64) -> Option<DateTime<Utc>> {
    if millis <= 0 {
        None
    } else {
        DateTime::from_timestamp_millis(millis)
    }
}

/// Utility function to format Unix timestamp in milliseconds to RFC3339 string
pub fn unix_millis_to_rfc3339(millis: i64) -> Option<String> {
    unix_millis_to_datetime(millis).map(|dt| dt.to_rfc3339())
}

impl<T> HarnessResponse<T> {
    pub fn is_success(&self) -> bool {
        self.status.to_lowercase() == "success"
    }

    pub fn into_data(self) -> Option<T> {
        self.data
    }
}

impl Scope {
    pub fn new(account_id: String) -> Self {
        Self {
            account_identifier: account_id,
            org_identifier: None,
            project_identifier: None,
        }
    }

    pub fn with_org(mut self, org_id: String) -> Self {
        self.org_identifier = Some(org_id);
        self
    }

    pub fn with_project(mut self, project_id: String) -> Self {
        self.project_identifier = Some(project_id);
        self
    }

    pub fn account_only(&self) -> bool {
        self.org_identifier.is_none() && self.project_identifier.is_none()
    }

    pub fn org_level(&self) -> bool {
        self.org_identifier.is_some() && self.project_identifier.is_none()
    }

    pub fn project_level(&self) -> bool {
        self.org_identifier.is_some() && self.project_identifier.is_some()
    }
}