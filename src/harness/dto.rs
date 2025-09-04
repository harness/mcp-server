// Data Transfer Objects for Harness API

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use uuid::Uuid;
use std::collections::HashMap;

// Utility function to format Unix timestamp in milliseconds to RFC3339 format
pub fn format_unix_millis_to_rfc3339(ms: i64) -> String {
    if ms <= 0 {
        return String::new();
    }
    let secs = ms / 1000;
    let nanos = ((ms % 1000) * 1_000_000) as u32;
    DateTime::from_timestamp(secs, nanos)
        .map(|dt| dt.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string())
        .unwrap_or_default()
}

// ===== CONNECTOR TYPES =====

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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Connector {
    pub name: String,
    pub identifier: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(rename = "accountIdentifier")]
    pub account_identifier: String,
    #[serde(rename = "orgIdentifier", skip_serializing_if = "Option::is_none")]
    pub org_identifier: Option<String>,
    #[serde(rename = "projectIdentifier", skip_serializing_if = "Option::is_none")]
    pub project_identifier: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<HashMap<String, String>>,
    #[serde(rename = "type")]
    pub connector_type: String,
    pub spec: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorError {
    pub reason: String,
    pub message: String,
    pub code: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorStatus {
    pub status: String,
    #[serde(rename = "errorSummary", skip_serializing_if = "Option::is_none")]
    pub error_summary: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub errors: Option<Vec<ConnectorError>>,
    #[serde(rename = "testedAt")]
    pub tested_at: i64,
    #[serde(rename = "lastTestedAt")]
    pub last_tested_at: i64,
    #[serde(rename = "lastConnectedAt")]
    pub last_connected_at: i64,
    #[serde(rename = "lastAlertSent")]
    pub last_alert_sent: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorStatusWithHumanTime {
    #[serde(flatten)]
    pub connector_status: ConnectorStatus,
    pub tested_at_time: String,
    pub last_tested_at_time: String,
    pub last_connected_at_time: String,
    pub last_alert_sent_time: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityDetails {
    #[serde(rename = "lastActivityTime")]
    pub last_activity_time: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityDetailsWithHumanTime {
    #[serde(flatten)]
    pub activity_details: ActivityDetails,
    pub last_activity_time_str: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitDetails {
    pub valid: bool,
    #[serde(rename = "invalidYaml", skip_serializing_if = "Option::is_none")]
    pub invalid_yaml: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityValidityDetails {
    pub valid: bool,
    #[serde(rename = "invalidYaml", skip_serializing_if = "Option::is_none")]
    pub invalid_yaml: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorDetail {
    pub connector: Connector,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "lastModifiedAt")]
    pub last_modified_at: i64,
    pub status: ConnectorStatus,
    #[serde(rename = "activityDetails")]
    pub activity_details: ActivityDetails,
    #[serde(rename = "harnessManaged")]
    pub harness_managed: bool,
    #[serde(rename = "gitDetails")]
    pub git_details: GitDetails,
    #[serde(rename = "entityValidityDetails")]
    pub entity_validity_details: EntityValidityDetails,
    #[serde(rename = "governanceMetadata", skip_serializing_if = "Option::is_none")]
    pub governance_metadata: Option<serde_json::Value>,
    #[serde(rename = "isFavorite")]
    pub is_favorite: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorDetailWithHumanTime {
    #[serde(flatten)]
    pub connector_detail: ConnectorDetail,
    pub created_at_time: String,
    pub last_modified_at_time: String,
    pub status: ConnectorStatusWithHumanTime,
    #[serde(rename = "activityDetails")]
    pub activity_details: ActivityDetailsWithHumanTime,
}

// ===== PIPELINE TYPES =====

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pipeline {
    pub identifier: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<HashMap<String, String>>,
    #[serde(rename = "createdAt", skip_serializing_if = "Option::is_none")]
    pub created_at: Option<i64>,
    #[serde(rename = "lastModifiedAt", skip_serializing_if = "Option::is_none")]
    pub last_modified_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TriggeredBy {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uuid: Option<Uuid>,
    pub identifier: String,
    #[serde(rename = "extraInfo", skip_serializing_if = "Option::is_none")]
    pub extra_info: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionTriggerInfo {
    #[serde(rename = "triggerType")]
    pub trigger_type: String,
    #[serde(rename = "triggeredBy", skip_serializing_if = "Option::is_none")]
    pub triggered_by: Option<TriggeredBy>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineExecution {
    #[serde(rename = "planExecutionId")]
    pub plan_execution_id: String,
    #[serde(rename = "pipelineIdentifier")]
    pub pipeline_identifier: String,
    pub status: String,
    #[serde(rename = "startTs", skip_serializing_if = "Option::is_none")]
    pub start_ts: Option<i64>,
    #[serde(rename = "endTs", skip_serializing_if = "Option::is_none")]
    pub end_ts: Option<i64>,
    #[serde(rename = "executionTriggerInfo", skip_serializing_if = "Option::is_none")]
    pub execution_trigger_info: Option<ExecutionTriggerInfo>,
}

// ===== REPOSITORY TYPES =====

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Repository {
    pub identifier: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(rename = "defaultBranch", skip_serializing_if = "Option::is_none")]
    pub default_branch: Option<String>,
    #[serde(rename = "createdAt", skip_serializing_if = "Option::is_none")]
    pub created_at: Option<i64>,
    #[serde(rename = "updatedAt", skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PullRequest {
    pub number: i32,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub state: String,
    #[serde(rename = "sourceBranch")]
    pub source_branch: String,
    #[serde(rename = "targetBranch")]
    pub target_branch: String,
    #[serde(rename = "createdAt", skip_serializing_if = "Option::is_none")]
    pub created_at: Option<i64>,
    #[serde(rename = "updatedAt", skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<i64>,
}

// ===== PAGINATION TYPES =====

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageInfo {
    pub page: i32,
    pub size: i32,
    #[serde(rename = "hasNext")]
    pub has_next: bool,
    #[serde(rename = "hasPrev")]
    pub has_prev: bool,
}

// ===== REQUEST/RESPONSE TYPES =====

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorListRequestBody {
    #[serde(rename = "connectorNames", skip_serializing_if = "Option::is_none")]
    pub connector_names: Option<Vec<String>>,
    #[serde(rename = "connectorIdentifiers", skip_serializing_if = "Option::is_none")]
    pub connector_identifiers: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub types: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub categories: Option<Vec<String>>,
    #[serde(rename = "connectivityStatuses", skip_serializing_if = "Option::is_none")]
    pub connectivity_statuses: Option<Vec<String>>,
    #[serde(rename = "inheritingCredentialsFromDelegate", skip_serializing_if = "Option::is_none")]
    pub inheriting_credentials_from_delegate: Option<bool>,
    #[serde(rename = "connectorConnectivityModes", skip_serializing_if = "Option::is_none")]
    pub connector_connectivity_modes: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<HashMap<String, String>>,
    #[serde(rename = "filterType", skip_serializing_if = "Option::is_none")]
    pub filter_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorListQueryParams {
    #[serde(rename = "searchTerm", skip_serializing_if = "Option::is_none")]
    pub search_term: Option<String>,
    #[serde(rename = "filterIdentifier", skip_serializing_if = "Option::is_none")]
    pub filter_identifier: Option<String>,
    #[serde(rename = "includeAllConnectorsAvailableAtScope", skip_serializing_if = "Option::is_none")]
    pub include_all_connectors_available_at_scope: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub branch: Option<String>,
    #[serde(rename = "repoIdentifier", skip_serializing_if = "Option::is_none")]
    pub repo_identifier: Option<String>,
    #[serde(rename = "getDefaultFromOtherRepo", skip_serializing_if = "Option::is_none")]
    pub get_default_from_other_repo: Option<bool>,
    #[serde(rename = "getDistinctFromBranches", skip_serializing_if = "Option::is_none")]
    pub get_distinct_from_branches: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(rename = "onlyFavorites", skip_serializing_if = "Option::is_none")]
    pub only_favorites: Option<bool>,
    #[serde(rename = "pageIndex", skip_serializing_if = "Option::is_none")]
    pub page_index: Option<i32>,
    #[serde(rename = "pageSize", skip_serializing_if = "Option::is_none")]
    pub page_size: Option<i32>,
    #[serde(rename = "sortOrders", skip_serializing_if = "Option::is_none")]
    pub sort_orders: Option<String>,
    #[serde(rename = "pageToken", skip_serializing_if = "Option::is_none")]
    pub page_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorListData {
    pub content: Vec<ConnectorDetail>,
    #[serde(rename = "pageInfo")]
    pub page_info: PageInfo,
    pub empty: bool,
    #[serde(rename = "totalElements")]
    pub total_elements: i32,
    #[serde(rename = "totalPages")]
    pub total_pages: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorListDataWithHumanTime {
    pub content: Vec<ConnectorDetailWithHumanTime>,
    #[serde(rename = "pageInfo")]
    pub page_info: PageInfo,
    pub empty: bool,
    #[serde(rename = "totalElements")]
    pub total_elements: i32,
    #[serde(rename = "totalPages")]
    pub total_pages: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorListResponse {
    pub status: String,
    pub data: ConnectorListData,
    #[serde(rename = "metaData", skip_serializing_if = "Option::is_none")]
    pub meta_data: Option<serde_json::Value>,
    #[serde(rename = "correlationId")]
    pub correlation_id: String,
}

// ===== CONVERSION FUNCTIONS =====

impl ConnectorStatus {
    pub fn to_human_time(&self) -> ConnectorStatusWithHumanTime {
        ConnectorStatusWithHumanTime {
            connector_status: self.clone(),
            tested_at_time: format_unix_millis_to_rfc3339(self.tested_at),
            last_tested_at_time: format_unix_millis_to_rfc3339(self.last_tested_at),
            last_connected_at_time: format_unix_millis_to_rfc3339(self.last_connected_at),
            last_alert_sent_time: format_unix_millis_to_rfc3339(self.last_alert_sent),
        }
    }
}

impl ActivityDetails {
    pub fn to_human_time(&self) -> ActivityDetailsWithHumanTime {
        ActivityDetailsWithHumanTime {
            activity_details: self.clone(),
            last_activity_time_str: format_unix_millis_to_rfc3339(self.last_activity_time),
        }
    }
}

impl ConnectorDetail {
    pub fn to_human_time(&self) -> ConnectorDetailWithHumanTime {
        ConnectorDetailWithHumanTime {
            connector_detail: self.clone(),
            created_at_time: format_unix_millis_to_rfc3339(self.created_at),
            last_modified_at_time: format_unix_millis_to_rfc3339(self.last_modified_at),
            status: self.status.to_human_time(),
            activity_details: self.activity_details.to_human_time(),
        }
    }
}

impl ConnectorListData {
    pub fn to_human_time(&self) -> ConnectorListDataWithHumanTime {
        ConnectorListDataWithHumanTime {
            content: self.content.iter().map(|item| item.to_human_time()).collect(),
            page_info: self.page_info.clone(),
            empty: self.empty,
            total_elements: self.total_elements,
            total_pages: self.total_pages,
        }
    }
}