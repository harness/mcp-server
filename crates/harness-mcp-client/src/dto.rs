use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

/// Generic entity wrapper for API responses
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entity<T> {
    pub status: Option<String>,
    pub data: Option<T>,
}

/// Generic list output for paginated responses
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListOutput<T> {
    pub status: Option<String>,
    pub data: Option<ListOutputData<T>>,
}

/// List output data with pagination information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListOutputData<T> {
    #[serde(rename = "totalElements")]
    pub total_elements: Option<i32>,
    #[serde(rename = "totalItems")]
    pub total_items: Option<i32>,
    #[serde(rename = "totalPages")]
    pub total_pages: Option<i32>,
    pub size: Option<i32>,
    #[serde(rename = "pageSize")]
    pub page_size: Option<i32>,
    pub content: Option<Vec<T>>,
    pub number: Option<i32>,
    #[serde(rename = "pageIndex")]
    pub page_index: Option<i32>,
    #[serde(rename = "pageItemCount")]
    pub page_item_count: Option<i32>,
    pub sort: Option<SortInfo>,
    pub first: Option<bool>,
    pub pageable: Option<PageableInfo>,
    #[serde(rename = "numberOfElements")]
    pub number_of_elements: Option<i32>,
    pub last: Option<bool>,
    pub empty: Option<bool>,
}

/// Pagination options for requests
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginationOptions {
    pub page: Option<i32>,
    pub size: Option<i32>,
}

/// Sort information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SortInfo {
    pub empty: Option<bool>,
    pub unsorted: Option<bool>,
    pub sorted: Option<bool>,
}

/// Pageable information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageableInfo {
    pub offset: Option<i32>,
    pub sort: Option<SortInfo>,
    pub paged: Option<bool>,
    pub unpaged: Option<bool>,
    #[serde(rename = "pageSize")]
    pub page_size: Option<i32>,
    #[serde(rename = "pageNumber")]
    pub page_number: Option<i32>,
}

/// Scope information for Harness resources
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Scope {
    #[serde(rename = "accountId")]
    pub account_id: String,
    #[serde(rename = "orgId")]
    pub org_id: Option<String>,
    #[serde(rename = "projectId")]
    pub project_id: Option<String>,
}

/// Git details for resources
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

/// User information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub email: Option<String>,
    #[serde(rename = "userName")]
    pub user_name: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<i64>,
}

// Pipeline-related DTOs

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

/// Pipeline list options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineListOptions {
    #[serde(flatten)]
    pub pagination: PaginationOptions,
    #[serde(rename = "searchTerm")]
    pub search_term: Option<String>,
}

/// Pipeline summary
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineSummary {
    pub identifier: Option<String>,
    pub name: Option<String>,
    pub description: Option<String>,
    pub tags: Option<HashMap<String, String>>,
    #[serde(rename = "orgIdentifier")]
    pub org_identifier: Option<String>,
    #[serde(rename = "projectIdentifier")]
    pub project_identifier: Option<String>,
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

/// Pipeline list item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineListItem {
    pub name: Option<String>,
    pub identifier: Option<String>,
    pub description: Option<String>,
    pub tags: Option<HashMap<String, String>>,
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
    pub filters: Option<HashMap<String, serde_json::Value>>,
    #[serde(rename = "stageNames")]
    pub stage_names: Option<Vec<String>>,
    #[serde(rename = "storeType")]
    pub store_type: Option<String>,
    #[serde(rename = "connectorRef")]
    pub connector_ref: Option<String>,
    #[serde(rename = "isDraft")]
    pub is_draft: Option<bool>,
    #[serde(rename = "yamlVersion")]
    pub yaml_version: Option<String>,
    #[serde(rename = "isInlineHCEntity")]
    pub is_inline_hc_entity: Option<bool>,
}

/// Execution summary information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionSummaryInfo {
    #[serde(rename = "numOfErrors")]
    pub num_of_errors: Option<Vec<i32>>,
    pub deployments: Option<Vec<i32>>,
    #[serde(rename = "lastExecutionTs")]
    pub last_execution_ts: Option<i64>,
    #[serde(rename = "lastExecutionStatus")]
    pub last_execution_status: Option<String>,
    #[serde(rename = "lastExecutionId")]
    pub last_execution_id: Option<String>,
}

/// Pipeline execution options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineExecutionOptions {
    #[serde(flatten)]
    pub pagination: PaginationOptions,
    pub status: Option<String>,
    #[serde(rename = "myDeployments")]
    pub my_deployments: Option<bool>,
    pub branch: Option<String>,
    #[serde(rename = "searchTerm")]
    pub search_term: Option<String>,
    #[serde(rename = "pipelineIdentifier")]
    pub pipeline_identifier: Option<String>,
    #[serde(rename = "pipelineTags")]
    pub pipeline_tags: Option<Vec<PipelineTag>>,
}

/// Pipeline tag
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineTag {
    pub key: Option<String>,
    pub value: Option<String>,
}

/// Pipeline execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineExecution {
    #[serde(rename = "pipelineIdentifier")]
    pub pipeline_identifier: Option<String>,
    #[serde(rename = "projectIdentifier")]
    pub project_identifier: Option<String>,
    #[serde(rename = "orgIdentifier")]
    pub org_identifier: Option<String>,
    #[serde(rename = "planExecutionId")]
    pub plan_execution_id: Option<String>,
    pub name: Option<String>,
    pub status: Option<String>,
    #[serde(rename = "failureInfo")]
    pub failure_info: Option<ExecutionFailureInfo>,
    #[serde(rename = "startTs")]
    pub start_ts: Option<i64>,
    #[serde(rename = "endTs")]
    pub end_ts: Option<i64>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<i64>,
    #[serde(rename = "connectorRef")]
    pub connector_ref: Option<String>,
    #[serde(rename = "successfulStagesCount")]
    pub successful_stages_count: Option<i32>,
    #[serde(rename = "failedStagesCount")]
    pub failed_stages_count: Option<i32>,
    #[serde(rename = "runningStagesCount")]
    pub running_stages_count: Option<i32>,
    #[serde(rename = "totalStagesRunningCount")]
    pub total_stages_running_count: Option<i32>,
    #[serde(rename = "stagesExecuted")]
    pub stages_executed: Option<Vec<String>>,
    #[serde(rename = "abortedBy")]
    pub aborted_by: Option<User>,
    #[serde(rename = "queuedType")]
    pub queued_type: Option<String>,
    #[serde(rename = "runSequence")]
    pub run_sequence: Option<i32>,
    #[serde(rename = "shouldUseSimplifiedBaseKey")]
    pub should_use_simplified_base_key: Option<bool>,
}

/// Execution failure information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionFailureInfo {
    #[serde(rename = "failureTypeList")]
    pub failure_type_list: Option<Vec<String>>,
    #[serde(rename = "responseMessages")]
    pub response_messages: Option<Vec<ExecutionResponseMessage>>,
}

/// Execution response message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResponseMessage {
    pub code: Option<String>,
    pub message: Option<String>,
    pub level: Option<String>,
    pub exception: Option<ExecutionException>,
}

/// Execution exception
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionException {
    pub message: Option<String>,
}

// Connector-related DTOs

/// Connector list item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorListItem {
    pub identifier: Option<String>,
    pub name: Option<String>,
    pub description: Option<String>,
    #[serde(rename = "type")]
    pub connector_type: Option<String>,
    pub tags: Option<HashMap<String, String>>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<i64>,
    #[serde(rename = "lastUpdatedAt")]
    pub last_updated_at: Option<i64>,
    pub status: Option<String>,
}

/// Connector details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorDetails {
    pub identifier: Option<String>,
    pub name: Option<String>,
    pub description: Option<String>,
    #[serde(rename = "type")]
    pub connector_type: Option<String>,
    pub spec: Option<serde_json::Value>,
    pub tags: Option<HashMap<String, String>>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<i64>,
    #[serde(rename = "lastUpdatedAt")]
    pub last_updated_at: Option<i64>,
    pub status: Option<String>,
}

// Dashboard-related DTOs

/// Dashboard list item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardListItem {
    pub id: Option<String>,
    pub name: Option<String>,
    pub description: Option<String>,
    #[serde(rename = "type")]
    pub dashboard_type: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<i64>,
    #[serde(rename = "lastUpdatedAt")]
    pub last_updated_at: Option<i64>,
}

/// Dashboard data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardData {
    pub id: Option<String>,
    pub name: Option<String>,
    pub data: Option<serde_json::Value>,
    pub widgets: Option<Vec<DashboardWidget>>,
}

/// Dashboard widget
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardWidget {
    pub id: Option<String>,
    pub name: Option<String>,
    #[serde(rename = "type")]
    pub widget_type: Option<String>,
    pub data: Option<serde_json::Value>,
}

impl Default for PaginationOptions {
    fn default() -> Self {
        Self {
            page: Some(0),
            size: Some(20),
        }
    }
}

impl Scope {
    /// Create a new scope
    pub fn new(account_id: String, org_id: Option<String>, project_id: Option<String>) -> Self {
        Self {
            account_id,
            org_id,
            project_id,
        }
    }

    /// Create an account-level scope
    pub fn account(account_id: String) -> Self {
        Self::new(account_id, None, None)
    }

    /// Create an organization-level scope
    pub fn organization(account_id: String, org_id: String) -> Self {
        Self::new(account_id, Some(org_id), None)
    }

    /// Create a project-level scope
    pub fn project(account_id: String, org_id: String, project_id: String) -> Self {
        Self::new(account_id, Some(org_id), Some(project_id))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_scope_creation() {
        let scope = Scope::account("account123".to_string());
        assert_eq!(scope.account_id, "account123");
        assert!(scope.org_id.is_none());
        assert!(scope.project_id.is_none());

        let scope = Scope::project("account123".to_string(), "org123".to_string(), "proj123".to_string());
        assert_eq!(scope.account_id, "account123");
        assert_eq!(scope.org_id, Some("org123".to_string()));
        assert_eq!(scope.project_id, Some("proj123".to_string()));
    }

    #[test]
    fn test_pagination_default() {
        let pagination = PaginationOptions::default();
        assert_eq!(pagination.page, Some(0));
        assert_eq!(pagination.size, Some(20));
    }

    #[test]
    fn test_entity_serialization() {
        let entity = Entity {
            status: Some("SUCCESS".to_string()),
            data: Some("test data".to_string()),
        };

        let json = serde_json::to_string(&entity).unwrap();
        assert!(json.contains("SUCCESS"));
        assert!(json.contains("test data"));

        let deserialized: Entity<String> = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.status, Some("SUCCESS".to_string()));
        assert_eq!(deserialized.data, Some("test data".to_string()));
    }
}