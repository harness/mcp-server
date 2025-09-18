use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Generic response wrapper for Harness API responses
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub status: String,
    pub data: Option<T>,
    pub error: Option<String>,
    #[serde(rename = "metaData")]
    pub meta_data: Option<serde_json::Value>,
    #[serde(rename = "correlationId")]
    pub correlation_id: Option<String>,
}

/// Generic list output structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListOutput<T> {
    pub data: PagedData<T>,
}

/// Paged data structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PagedData<T> {
    pub content: Vec<T>,
    #[serde(rename = "totalItems")]
    pub total_items: i64,
    #[serde(rename = "totalElements")]
    pub total_elements: i64,
    #[serde(rename = "totalPages")]
    pub total_pages: i64,
    #[serde(rename = "pageIndex")]
    pub page_index: i64,
    #[serde(rename = "pageSize")]
    pub page_size: i64,
    pub empty: bool,
}

/// Core connector information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Connector {
    pub name: String,
    pub identifier: String,
    pub description: Option<String>,
    #[serde(rename = "accountIdentifier")]
    pub account_identifier: String,
    #[serde(rename = "orgIdentifier")]
    pub org_identifier: Option<String>,
    #[serde(rename = "projectIdentifier")]
    pub project_identifier: Option<String>,
    pub tags: Option<HashMap<String, String>>,
    #[serde(rename = "type")]
    pub connector_type: String,
    pub spec: Option<serde_json::Value>,
}

/// Connector error information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorError {
    pub reason: Option<String>,
    pub message: Option<String>,
    pub code: Option<i32>,
}

/// Connector status information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorStatus {
    pub status: Option<String>,
    #[serde(rename = "errorSummary")]
    pub error_summary: Option<String>,
    pub errors: Option<Vec<ConnectorError>>,
    #[serde(rename = "testedAt")]
    pub tested_at: Option<i64>,
    #[serde(rename = "lastTestedAt")]
    pub last_tested_at: Option<i64>,
    #[serde(rename = "lastConnectedAt")]
    pub last_connected_at: Option<i64>,
    #[serde(rename = "lastAlertSent")]
    pub last_alert_sent: Option<i64>,
}

/// Activity details for connectors
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityDetails {
    #[serde(rename = "lastActivityTime")]
    pub last_activity_time: Option<i64>,
}

/// Git details for connectors
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorGitDetails {
    pub valid: Option<bool>,
    #[serde(rename = "invalidYaml")]
    pub invalid_yaml: Option<String>,
}

/// Entity validity details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorEntityValidityDetails {
    pub valid: Option<bool>,
    #[serde(rename = "invalidYaml")]
    pub invalid_yaml: Option<String>,
}

/// Detailed connector information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorDetail {
    pub connector: Connector,
    #[serde(rename = "createdAt")]
    pub created_at: Option<i64>,
    #[serde(rename = "lastModifiedAt")]
    pub last_modified_at: Option<i64>,
    pub status: Option<ConnectorStatus>,
    #[serde(rename = "activityDetails")]
    pub activity_details: Option<ActivityDetails>,
    #[serde(rename = "harnessManaged")]
    pub harness_managed: Option<bool>,
    #[serde(rename = "gitDetails")]
    pub git_details: Option<ConnectorGitDetails>,
    #[serde(rename = "entityValidityDetails")]
    pub entity_validity_details: Option<ConnectorEntityValidityDetails>,
    #[serde(rename = "governanceMetadata")]
    pub governance_metadata: Option<serde_json::Value>,
    #[serde(rename = "isFavorite")]
    pub is_favorite: Option<bool>,
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
    pub new_until: Option<String>, // RFC3339 timestamp
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

/// User information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub email: Option<String>,
    #[serde(rename = "userName")]
    pub user_name: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<i64>,
}

/// Execution exception details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionException {
    pub message: Option<String>,
}

/// Execution response message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResponseMessage {
    pub code: Option<String>,
    pub message: Option<String>,
    pub level: Option<String>,
    pub exception: Option<ExecutionException>,
}

/// Execution failure information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionFailureInfo {
    #[serde(rename = "failureTypeList")]
    pub failure_type_list: Option<Vec<String>>,
    #[serde(rename = "responseMessages")]
    pub response_messages: Option<Vec<ExecutionResponseMessage>>,
}

/// Pipeline execution details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineExecution {
    #[serde(rename = "pipelineIdentifier")]
    pub pipeline_identifier: Option<String>,
    #[serde(rename = "projectIdentifier")]
    pub project_identifier: Option<String>,
    #[serde(rename = "orgIdentifier")]
    pub org_identifier: Option<String>,
    #[serde(rename = "planExecutionId")]
    pub plan_execution_id: String,
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
    #[serde(rename = "shouldUseSimplifiedKey")]
    pub should_use_simplified_base_key: Option<bool>,
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

/// Pipeline summary
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineSummary {
    pub identifier: String,
    pub name: String,
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

/// Git details for pipelines and input sets
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitDetails {
    pub valid: Option<bool>,
    #[serde(rename = "invalidYaml")]
    pub invalid_yaml: Option<String>,
}

/// Entity validity details for pipelines and input sets
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityValidityDetails {
    pub valid: Option<bool>,
    #[serde(rename = "invalidYaml")]
    pub invalid_yaml: Option<String>,
}

/// Pipeline data structure
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

/// Input set error details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InputSetErrorDetails {
    #[serde(rename = "errorPipelineYaml")]
    pub error_pipeline_yaml: Option<String>,
    #[serde(rename = "uuidToErrorResponseMap")]
    pub uuid_to_error_response_map: Option<HashMap<String, serde_json::Value>>,
    #[serde(rename = "invalidInputSetReferences")]
    pub invalid_input_set_references: Option<Vec<String>>,
    #[serde(rename = "type")]
    pub error_type: Option<String>,
}

/// Input set list item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InputSet {
    pub identifier: String,
    pub name: String,
    #[serde(rename = "pipelineIdentifier")]
    pub pipeline_identifier: Option<String>,
    pub description: Option<String>,
    #[serde(rename = "inputSetType")]
    pub input_set_type: Option<String>,
    pub tags: Option<HashMap<String, String>>,
    #[serde(rename = "gitDetails")]
    pub git_details: Option<GitDetails>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<i64>,
    #[serde(rename = "lastUpdatedAt")]
    pub last_updated_at: Option<i64>,
    #[serde(rename = "isOutdated")]
    pub is_outdated: Option<bool>,
    #[serde(rename = "inputSetErrorDetails")]
    pub input_set_error_details: Option<InputSetErrorDetails>,
    #[serde(rename = "overlaySetErrorDetails")]
    pub overlay_set_error_details: Option<HashMap<String, String>>,
    #[serde(rename = "entityValidityDetails")]
    pub entity_validity_details: Option<EntityValidityDetails>,
    pub modules: Option<Vec<String>>,
}

/// Input set detail
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InputSetDetail {
    #[serde(rename = "accountId")]
    pub account_id: Option<String>,
    #[serde(rename = "orgIdentifier")]
    pub org_identifier: Option<String>,
    #[serde(rename = "projectIdentifier")]
    pub project_identifier: Option<String>,
    #[serde(rename = "pipelineIdentifier")]
    pub pipeline_identifier: Option<String>,
    pub identifier: String,
    #[serde(rename = "inputSetYaml")]
    pub input_set_yaml: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub tags: Option<HashMap<String, String>>,
    #[serde(rename = "inputSetErrorWrapper")]
    pub input_set_error_wrapper: Option<InputSetErrorDetails>,
    #[serde(rename = "gitDetails")]
    pub git_details: Option<GitDetails>,
    #[serde(rename = "entityValidityDetails")]
    pub entity_validity_details: Option<EntityValidityDetails>,
    pub outdated: Option<bool>,
    #[serde(rename = "errorResponse")]
    pub error_response: Option<bool>,
}

/// Input set list response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InputSetListResponse {
    pub data: PagedData<InputSet>,
}

/// Webhook details for triggers
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookDetails {
    #[serde(rename = "webhookSecret")]
    pub webhook_secret: Option<String>,
    #[serde(rename = "webhookSourceRepo")]
    pub webhook_source_repo: Option<String>,
}

/// Validation status for triggers
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationStatus {
    #[serde(rename = "statusResult")]
    pub status_result: Option<String>,
    #[serde(rename = "detailedMessage")]
    pub detailed_message: Option<String>,
}

/// Webhook auto registration status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookAutoRegistrationStatus {
    #[serde(rename = "registrationResult")]
    pub registration_result: Option<String>,
    #[serde(rename = "detailedMessage")]
    pub detailed_message: Option<String>,
}

/// Webhook info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookInfo {
    #[serde(rename = "webhookId")]
    pub webhook_id: Option<String>,
}

/// Trigger status information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TriggerStatus {
    #[serde(rename = "pollingSubscriptionStatus")]
    pub polling_subscription_status: Option<serde_json::Value>,
    #[serde(rename = "validationStatus")]
    pub validation_status: Option<ValidationStatus>,
    #[serde(rename = "webhookAutoRegistrationStatus")]
    pub webhook_auto_registration_status: Option<WebhookAutoRegistrationStatus>,
    #[serde(rename = "webhookInfo")]
    pub webhook_info: Option<WebhookInfo>,
    pub status: Option<String>,
    #[serde(rename = "detailMessages")]
    pub detail_messages: Option<Vec<String>>,
    #[serde(rename = "lastPollingUpdate")]
    pub last_polling_update: Option<serde_json::Value>,
    #[serde(rename = "lastPolled")]
    pub last_polled: Option<serde_json::Value>,
}

/// Trigger list item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TriggerListItem {
    pub name: Option<String>,
    pub identifier: String,
    pub description: Option<String>,
    pub tags: Option<HashMap<String, String>>,
    #[serde(rename = "type")]
    pub trigger_type: String,
    pub enabled: Option<bool>,
    pub yaml: Option<String>,
    #[serde(rename = "webhookUrl")]
    pub webhook_url: Option<String>,
    #[serde(rename = "registrationStatus")]
    pub registration_status: Option<String>,
    #[serde(rename = "yamlVersion")]
    pub yaml_version: Option<String>,
    #[serde(rename = "triggerStatus")]
    pub trigger_status: Option<TriggerStatus>,
    #[serde(rename = "webhookDetails")]
    pub webhook_details: Option<WebhookDetails>,
    pub executions: Option<Vec<i32>>,
    #[serde(rename = "webhookCurlCommand")]
    pub webhook_curl_command: Option<String>,
    #[serde(rename = "pipelineInputOutdated")]
    pub pipeline_input_outdated: Option<bool>,
    // Backward compatibility fields
    #[serde(rename = "createdAt")]
    pub created_at: Option<i64>,
    #[serde(rename = "lastUpdatedAt")]
    pub last_updated_at: Option<i64>,
    #[serde(rename = "targetIdentifier")]
    pub target_identifier: Option<String>,
    #[serde(rename = "pipelineIdentifier")]
    pub pipeline_identifier: Option<String>,
}

/// Generic entity wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entity<T> {
    pub status: String,
    pub data: T,
    #[serde(rename = "metaData")]
    pub meta_data: Option<serde_json::Value>,
    #[serde(rename = "correlationId")]
    pub correlation_id: Option<String>,
}