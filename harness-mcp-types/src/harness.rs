use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use chrono::{DateTime, Utc};

/// Generic entity wrapper for API responses
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entity<T> {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
}

/// Generic list output for paginated responses
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListOutput<T> {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<ListOutputData<T>>,
}

/// Data field for list responses with pagination information
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

/// Pagination options for API requests
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginationOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<i32>,
}

/// Sort information for paginated responses
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SortInfo {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub empty: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unsorted: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sorted: Option<bool>,
}

/// Pageable information for pagination
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

/// User information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(rename = "userName", skip_serializing_if = "Option::is_none")]
    pub user_name: Option<String>,
}

/// Pipeline-related data structures
pub mod pipeline {
    use super::*;

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

    /// Git details for pipeline
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct GitDetails {
        #[serde(skip_serializing_if = "Option::is_none")]
        pub valid: Option<bool>,
        #[serde(rename = "invalidYaml", skip_serializing_if = "Option::is_none")]
        pub invalid_yaml: Option<String>,
    }

    /// Entity validity details
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct EntityValidityDetails {
        #[serde(skip_serializing_if = "Option::is_none")]
        pub valid: Option<bool>,
        #[serde(rename = "invalidYaml", skip_serializing_if = "Option::is_none")]
        pub invalid_yaml: Option<String>,
    }

    /// Pipeline list options
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct PipelineListOptions {
        #[serde(flatten)]
        pub pagination: PaginationOptions,
        #[serde(rename = "searchTerm", skip_serializing_if = "Option::is_none")]
        pub search_term: Option<String>,
    }

    /// Pipeline summary information
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

    /// Pipeline tag for filtering
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct PipelineTag {
        #[serde(skip_serializing_if = "Option::is_none")]
        pub key: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        pub value: Option<String>,
    }

    /// Pipeline execution options
    #[derive(Debug, Clone, Serialize, Deserialize)]
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

    /// Pipeline execution details
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
        #[serde(rename = "shouldUseSimplifiedBaseKey", skip_serializing_if = "Option::is_none")]
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

    /// Execution exception details
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct ExecutionException {
        #[serde(skip_serializing_if = "Option::is_none")]
        pub message: Option<String>,
    }
}

/// Access control module
pub mod access_control;

/// Service module
pub mod service;

/// Environment module
pub mod environment;

/// Connector-related data structures
pub mod connector {
    use super::*;

    /// Connector catalogue item
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct ConnectorCatalogueItem {
        #[serde(skip_serializing_if = "Option::is_none")]
        pub category: Option<String>,
        #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
        pub connector_type: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        pub name: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        pub description: Option<String>,
        #[serde(rename = "logoURL", skip_serializing_if = "Option::is_none")]
        pub logo_url: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        pub tags: Option<Vec<String>>,
        #[serde(rename = "harnessManaged", skip_serializing_if = "Option::is_none")]
        pub harness_managed: Option<bool>,
        #[serde(skip_serializing_if = "Option::is_none")]
        pub beta: Option<bool>,
        #[serde(rename = "comingSoon", skip_serializing_if = "Option::is_none")]
        pub coming_soon: Option<bool>,
        #[serde(rename = "comingSoonDate", skip_serializing_if = "Option::is_none")]
        pub coming_soon_date: Option<String>,
        #[serde(rename = "comingSoonDescription", skip_serializing_if = "Option::is_none")]
        pub coming_soon_description: Option<String>,
        #[serde(rename = "isNew", skip_serializing_if = "Option::is_none")]
        pub is_new: Option<bool>,
        #[serde(rename = "newUntil", skip_serializing_if = "Option::is_none")]
        pub new_until: Option<DateTime<Utc>>,
        #[serde(rename = "supportedDelegateTypes", skip_serializing_if = "Option::is_none")]
        pub supported_delegate_types: Option<Vec<String>>,
        #[serde(rename = "delegateSelectors", skip_serializing_if = "Option::is_none")]
        pub delegate_selectors: Option<Vec<String>>,
        #[serde(rename = "delegateRequiresConnectivityMode", skip_serializing_if = "Option::is_none")]
        pub delegate_requires_connectivity_mode: Option<bool>,
        #[serde(rename = "connectivityModes", skip_serializing_if = "Option::is_none")]
        pub connectivity_modes: Option<Vec<String>>,
        #[serde(rename = "documentationLink", skip_serializing_if = "Option::is_none")]
        pub documentation_link: Option<String>,
        #[serde(rename = "isSSCA", skip_serializing_if = "Option::is_none")]
        pub is_ssca: Option<bool>,
        #[serde(rename = "sscaDescription", skip_serializing_if = "Option::is_none")]
        pub ssca_description: Option<String>,
        #[serde(rename = "sscaDocumentationLink", skip_serializing_if = "Option::is_none")]
        pub ssca_documentation_link: Option<String>,
        #[serde(rename = "sscaType", skip_serializing_if = "Option::is_none")]
        pub ssca_type: Option<String>,
        #[serde(rename = "sscaSupported", skip_serializing_if = "Option::is_none")]
        pub ssca_supported: Option<bool>,
    }

    /// Connector detail information
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct ConnectorDetail {
        #[serde(skip_serializing_if = "Option::is_none")]
        pub connector: Option<Connector>,
        #[serde(rename = "createdAt", skip_serializing_if = "Option::is_none")]
        pub created_at: Option<i64>,
        #[serde(rename = "lastModifiedAt", skip_serializing_if = "Option::is_none")]
        pub last_modified_at: Option<i64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        pub status: Option<ConnectorStatus>,
        #[serde(rename = "activityDetails", skip_serializing_if = "Option::is_none")]
        pub activity_details: Option<ConnectorActivityDetails>,
        #[serde(rename = "harnessManaged", skip_serializing_if = "Option::is_none")]
        pub harness_managed: Option<bool>,
        #[serde(rename = "gitDetails", skip_serializing_if = "Option::is_none")]
        pub git_details: Option<ConnectorGitDetails>,
        #[serde(rename = "entityValidityDetails", skip_serializing_if = "Option::is_none")]
        pub entity_validity_details: Option<ConnectorEntityValidityDetails>,
        #[serde(rename = "governanceMetadata", skip_serializing_if = "Option::is_none")]
        pub governance_metadata: Option<ConnectorGovernanceMetadata>,
    }

    /// Connector information
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct Connector {
        #[serde(skip_serializing_if = "Option::is_none")]
        pub name: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        pub identifier: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        pub description: Option<String>,
        #[serde(rename = "orgIdentifier", skip_serializing_if = "Option::is_none")]
        pub org_identifier: Option<String>,
        #[serde(rename = "projectIdentifier", skip_serializing_if = "Option::is_none")]
        pub project_identifier: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        pub tags: Option<HashMap<String, String>>,
        #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
        pub connector_type: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        pub spec: Option<serde_json::Value>,
    }

    /// Connector status information
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct ConnectorStatus {
        #[serde(skip_serializing_if = "Option::is_none")]
        pub status: Option<String>,
        #[serde(rename = "errorSummary", skip_serializing_if = "Option::is_none")]
        pub error_summary: Option<String>,
        #[serde(rename = "errors", skip_serializing_if = "Option::is_none")]
        pub errors: Option<Vec<ConnectorError>>,
        #[serde(rename = "testedAt", skip_serializing_if = "Option::is_none")]
        pub tested_at: Option<i64>,
        #[serde(rename = "lastTestedAt", skip_serializing_if = "Option::is_none")]
        pub last_tested_at: Option<i64>,
        #[serde(rename = "lastConnectedAt", skip_serializing_if = "Option::is_none")]
        pub last_connected_at: Option<i64>,
    }

    /// Connector error information
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct ConnectorError {
        #[serde(skip_serializing_if = "Option::is_none")]
        pub reason: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        pub message: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        pub code: Option<i32>,
    }

    /// Connector activity details
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct ConnectorActivityDetails {
        #[serde(rename = "lastActivityTime", skip_serializing_if = "Option::is_none")]
        pub last_activity_time: Option<i64>,
    }

    /// Connector git details
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct ConnectorGitDetails {
        #[serde(rename = "objectId", skip_serializing_if = "Option::is_none")]
        pub object_id: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        pub branch: Option<String>,
        #[serde(rename = "repoIdentifier", skip_serializing_if = "Option::is_none")]
        pub repo_identifier: Option<String>,
        #[serde(rename = "rootFolder", skip_serializing_if = "Option::is_none")]
        pub root_folder: Option<String>,
        #[serde(rename = "filePath", skip_serializing_if = "Option::is_none")]
        pub file_path: Option<String>,
        #[serde(rename = "repoName", skip_serializing_if = "Option::is_none")]
        pub repo_name: Option<String>,
        #[serde(rename = "commitId", skip_serializing_if = "Option::is_none")]
        pub commit_id: Option<String>,
        #[serde(rename = "fileUrl", skip_serializing_if = "Option::is_none")]
        pub file_url: Option<String>,
        #[serde(rename = "repoUrl", skip_serializing_if = "Option::is_none")]
        pub repo_url: Option<String>,
    }

    /// Connector entity validity details
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct ConnectorEntityValidityDetails {
        #[serde(skip_serializing_if = "Option::is_none")]
        pub valid: Option<bool>,
        #[serde(rename = "invalidYaml", skip_serializing_if = "Option::is_none")]
        pub invalid_yaml: Option<String>,
    }

    /// Connector governance metadata
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct ConnectorGovernanceMetadata {
        #[serde(skip_serializing_if = "Option::is_none")]
        pub id: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        pub deny: Option<bool>,
        #[serde(skip_serializing_if = "Option::is_none")]
        pub details: Option<serde_json::Value>,
    }
}