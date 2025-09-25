use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use super::common::PageInfo;

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
    pub new_until: Option<String>,
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

/// Connector detail information
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
    pub git_details: ConnectorGitDetails,
    #[serde(rename = "entityValidityDetails")]
    pub entity_validity_details: ConnectorEntityValidityDetails,
    #[serde(rename = "governanceMetadata")]
    pub governance_metadata: Option<serde_json::Value>,
    #[serde(rename = "isFavorite")]
    pub is_favorite: bool,
}

/// Core connector information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Connector {
    pub name: String,
    pub identifier: String,
    pub description: String,
    #[serde(rename = "accountIdentifier")]
    pub account_identifier: String,
    #[serde(rename = "orgIdentifier")]
    pub org_identifier: String,
    #[serde(rename = "projectIdentifier")]
    pub project_identifier: String,
    pub tags: HashMap<String, String>,
    #[serde(rename = "type")]
    pub connector_type: String,
    pub spec: HashMap<String, serde_json::Value>,
}

/// Connector entity validity details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorEntityValidityDetails {
    pub valid: bool,
    #[serde(rename = "invalidYaml")]
    pub invalid_yaml: String,
}

/// Connector status information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorStatus {
    pub status: String,
    #[serde(rename = "errorSummary")]
    pub error_summary: String,
    pub errors: Vec<ConnectorError>,
    #[serde(rename = "testedAt")]
    pub tested_at: i64,
    #[serde(rename = "lastTestedAt")]
    pub last_tested_at: i64,
    #[serde(rename = "lastConnectedAt")]
    pub last_connected_at: i64,
    #[serde(rename = "lastAlertSent")]
    pub last_alert_sent: i64,
}

/// Connector error information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorError {
    pub reason: String,
    pub message: String,
    pub code: i32,
}

/// Activity details for connector
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityDetails {
    #[serde(rename = "lastActivityTime")]
    pub last_activity_time: i64,
}

/// Connector git details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorGitDetails {
    pub valid: bool,
    #[serde(rename = "invalidYaml")]
    pub invalid_yaml: String,
}

/// Connector list request body
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorListRequestBody {
    #[serde(rename = "connectorNames")]
    pub connector_names: Option<Vec<String>>,
    #[serde(rename = "connectorIdentifiers")]
    pub connector_identifiers: Option<Vec<String>>,
    pub description: Option<String>,
    pub types: Option<Vec<String>>,
    pub categories: Option<Vec<String>>,
    #[serde(rename = "connectivityStatuses")]
    pub connectivity_statuses: Option<Vec<String>>,
    #[serde(rename = "inheritingCredentialsFromDelegate")]
    pub inheriting_credentials_from_delegate: Option<bool>,
    #[serde(rename = "connectorConnectivityModes")]
    pub connector_connectivity_modes: Option<Vec<String>>,
    pub tags: Option<HashMap<String, String>>,
    #[serde(rename = "filterType")]
    pub filter_type: Option<String>,
}

/// Connector list query parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorListQueryParams {
    #[serde(rename = "searchTerm")]
    pub search_term: Option<String>,
    #[serde(rename = "filterIdentifier")]
    pub filter_identifier: Option<String>,
    #[serde(rename = "includeAllConnectorsAvailableAtScope")]
    pub include_all_connectors_available_at_scope: Option<bool>,
    pub branch: Option<String>,
    #[serde(rename = "repoIdentifier")]
    pub repo_identifier: Option<String>,
    #[serde(rename = "getDefaultFromOtherRepo")]
    pub get_default_from_other_repo: Option<bool>,
    #[serde(rename = "getDistinctFromBranches")]
    pub get_distinct_from_branches: Option<bool>,
    pub version: Option<String>,
    #[serde(rename = "onlyFavorites")]
    pub only_favorites: Option<bool>,
    #[serde(rename = "pageIndex")]
    pub page_index: Option<i32>,
    #[serde(rename = "pageSize")]
    pub page_size: Option<i32>,
    #[serde(rename = "sortOrders")]
    pub sort_orders: Option<String>,
    #[serde(rename = "pageToken")]
    pub page_token: Option<String>,
}