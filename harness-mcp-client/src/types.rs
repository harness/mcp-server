//! Common types for Harness API

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Scope information for Harness API requests
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Scope {
    /// Account ID
    pub account_id: String,
    /// Organization ID (optional)
    pub org_id: Option<String>,
    /// Project ID (optional)
    pub project_id: Option<String>,
}

impl Scope {
    /// Create a new scope with account ID only
    pub fn account(account_id: impl Into<String>) -> Self {
        Self {
            account_id: account_id.into(),
            org_id: None,
            project_id: None,
        }
    }

    /// Create a new scope with account and org ID
    pub fn org(account_id: impl Into<String>, org_id: impl Into<String>) -> Self {
        Self {
            account_id: account_id.into(),
            org_id: Some(org_id.into()),
            project_id: None,
        }
    }

    /// Create a new scope with account, org, and project ID
    pub fn project(
        account_id: impl Into<String>,
        org_id: impl Into<String>,
        project_id: impl Into<String>,
    ) -> Self {
        Self {
            account_id: account_id.into(),
            org_id: Some(org_id.into()),
            project_id: Some(project_id.into()),
        }
    }

    /// Convert to query parameters
    pub fn to_query_params(&self) -> HashMap<String, String> {
        let mut params = HashMap::new();
        params.insert("accountIdentifier".to_string(), self.account_id.clone());
        
        if let Some(org_id) = &self.org_id {
            params.insert("orgIdentifier".to_string(), org_id.clone());
        }
        
        if let Some(project_id) = &self.project_id {
            params.insert("projectIdentifier".to_string(), project_id.clone());
        }
        
        params
    }
}

/// Generic API response wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub status: String,
    pub data: Option<T>,
    pub error: Option<String>,
    pub code: Option<String>,
    pub message: Option<String>,
}

/// Generic entity wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entity<T> {
    pub status: String,
    pub data: T,
}

/// Generic list response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListResponse<T> {
    pub status: String,
    pub data: ListData<T>,
}

/// List data wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListData<T> {
    #[serde(rename = "totalElements")]
    pub total_elements: Option<i32>,
    #[serde(rename = "totalItems")]
    pub total_items: Option<i32>,
    #[serde(rename = "totalPages")]
    pub total_pages: Option<i32>,
    pub size: Option<i32>,
    #[serde(rename = "pageSize")]
    pub page_size: Option<i32>,
    pub content: Vec<T>,
    pub number: Option<i32>,
    #[serde(rename = "pageIndex")]
    pub page_index: Option<i32>,
    #[serde(rename = "pageItemCount")]
    pub page_item_count: Option<i32>,
    pub empty: Option<bool>,
    pub first: Option<bool>,
    pub last: Option<bool>,
}

/// Pagination parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pagination {
    pub page: Option<i32>,
    pub size: Option<i32>,
    pub sort: Option<String>,
    pub order: Option<String>,
}

impl Default for Pagination {
    fn default() -> Self {
        Self {
            page: Some(0),
            size: Some(50),
            sort: None,
            order: None,
        }
    }
}

/// Git details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitDetails {
    pub valid: Option<bool>,
    #[serde(rename = "invalidYaml")]
    pub invalid_yaml: Option<String>,
}

/// Entity validity details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityValidityDetails {
    pub valid: Option<bool>,
    #[serde(rename = "invalidYaml")]
    pub invalid_yaml: Option<String>,
}

/// Repository information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Repository {
    pub archived: Option<bool>,
    pub created: Option<i64>,
    #[serde(rename = "created_by")]
    pub created_by: Option<i32>,
    #[serde(rename = "default_branch")]
    pub default_branch: Option<String>,
    pub deleted: Option<i64>,
    pub description: Option<String>,
    #[serde(rename = "fork_id")]
    pub fork_id: Option<i32>,
    #[serde(rename = "git_ssh_url")]
    pub git_ssh_url: Option<String>,
    #[serde(rename = "git_url")]
    pub git_url: Option<String>,
    pub id: Option<i32>,
    pub identifier: Option<String>,
    pub importing: Option<bool>,
    #[serde(rename = "is_empty")]
    pub is_empty: Option<bool>,
    #[serde(rename = "is_public")]
    pub is_public: Option<bool>,
    #[serde(rename = "last_git_push")]
    pub last_git_push: Option<i64>,
    #[serde(rename = "num_closed_pulls")]
    pub num_closed_pulls: Option<i32>,
    #[serde(rename = "num_forks")]
    pub num_forks: Option<i32>,
    #[serde(rename = "num_merged_pulls")]
    pub num_merged_pulls: Option<i32>,
    #[serde(rename = "num_open_pulls")]
    pub num_open_pulls: Option<i32>,
    #[serde(rename = "num_pulls")]
    pub num_pulls: Option<i32>,
    #[serde(rename = "parent_id")]
    pub parent_id: Option<i32>,
    pub path: Option<String>,
    pub size: Option<i64>,
    #[serde(rename = "size_updated")]
    pub size_updated: Option<i64>,
    pub state: Option<i32>,
    pub updated: Option<i64>,
}

/// Pipeline data
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

/// Connector catalogue item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorCatalogueItem {
    pub category: Option<String>,
    #[serde(rename = "type")]
    pub connector_type: Option<String>,
    pub name: Option<String>,
    pub description: Option<String>,
    #[serde(rename = "logoURL")]
    pub logo_url: Option<String>,
    pub tags: Option<Vec<String>>,
    #[serde(rename = "harnessManaged")]
    pub harness_managed: Option<bool>,
    pub beta: Option<bool>,
    #[serde(rename = "comingSoon")]
    pub coming_soon: Option<bool>,
    #[serde(rename = "comingSoonDate")]
    pub coming_soon_date: Option<String>,
    #[serde(rename = "comingSoonDescription")]
    pub coming_soon_description: Option<String>,
    #[serde(rename = "isNew")]
    pub is_new: Option<bool>,
    #[serde(rename = "newUntil")]
    pub new_until: Option<DateTime<Utc>>,
    #[serde(rename = "supportedDelegateTypes")]
    pub supported_delegate_types: Option<Vec<String>>,
    #[serde(rename = "delegateSelectors")]
    pub delegate_selectors: Option<Vec<String>>,
    #[serde(rename = "delegateRequiresConnectivityMode")]
    pub delegate_requires_connectivity_mode: Option<bool>,
    #[serde(rename = "connectivityModes")]
    pub connectivity_modes: Option<Vec<String>>,
    #[serde(rename = "documentationLink")]
    pub documentation_link: Option<String>,
    #[serde(rename = "isSSCA")]
    pub is_ssca: Option<bool>,
    #[serde(rename = "sscaDescription")]
    pub ssca_description: Option<String>,
    #[serde(rename = "sscaDocumentationLink")]
    pub ssca_documentation_link: Option<String>,
    #[serde(rename = "sscaType")]
    pub ssca_type: Option<String>,
    #[serde(rename = "sscaSupported")]
    pub ssca_supported: Option<bool>,
}

/// Utility function to format Unix timestamp in milliseconds to RFC3339
pub fn format_unix_millis_to_rfc3339(ms: i64) -> Option<String> {
    if ms <= 0 {
        return None;
    }
    
    let dt = DateTime::from_timestamp_millis(ms)?;
    Some(dt.to_rfc3339())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_scope_creation() {
        let scope = Scope::account("acc123");
        assert_eq!(scope.account_id, "acc123");
        assert_eq!(scope.org_id, None);
        assert_eq!(scope.project_id, None);

        let scope = Scope::org("acc123", "org456");
        assert_eq!(scope.account_id, "acc123");
        assert_eq!(scope.org_id, Some("org456".to_string()));
        assert_eq!(scope.project_id, None);

        let scope = Scope::project("acc123", "org456", "proj789");
        assert_eq!(scope.account_id, "acc123");
        assert_eq!(scope.org_id, Some("org456".to_string()));
        assert_eq!(scope.project_id, Some("proj789".to_string()));
    }

    #[test]
    fn test_scope_query_params() {
        let scope = Scope::project("acc123", "org456", "proj789");
        let params = scope.to_query_params();
        
        assert_eq!(params.get("accountIdentifier"), Some(&"acc123".to_string()));
        assert_eq!(params.get("orgIdentifier"), Some(&"org456".to_string()));
        assert_eq!(params.get("projectIdentifier"), Some(&"proj789".to_string()));
    }

    #[test]
    fn test_format_unix_millis() {
        let result = format_unix_millis_to_rfc3339(1640995200000); // 2022-01-01T00:00:00Z
        assert!(result.is_some());
        assert!(result.unwrap().starts_with("2022-01-01"));

        let result = format_unix_millis_to_rfc3339(0);
        assert_eq!(result, None);

        let result = format_unix_millis_to_rfc3339(-1);
        assert_eq!(result, None);
    }
}