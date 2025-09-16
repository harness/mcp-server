use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use chrono::{DateTime, Utc};
use crate::types::common::{GitDetails, EntityValidityDetails, unix_millis_to_rfc3339};

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

/// Core connector information
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
    pub spec: serde_json::Value,
}

/// Connector error information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorError {
    pub reason: String,
    pub message: String,
    pub code: i32,
}

/// Connector status information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorStatus {
    pub status: String,
    #[serde(rename = "errorSummary", skip_serializing_if = "Option::is_none")]
    pub error_summary: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub errors: Option<Vec<ConnectorError>>,
    #[serde(rename = "testedAt", skip_serializing_if = "Option::is_none")]
    pub tested_at: Option<i64>,
    #[serde(rename = "lastTestedAt", skip_serializing_if = "Option::is_none")]
    pub last_tested_at: Option<i64>,
    #[serde(rename = "lastConnectedAt", skip_serializing_if = "Option::is_none")]
    pub last_connected_at: Option<i64>,
    #[serde(rename = "lastAlertSent", skip_serializing_if = "Option::is_none")]
    pub last_alert_sent: Option<i64>,
}

/// Connector status with human-readable timestamps
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorStatusWithHumanTime {
    #[serde(flatten)]
    pub status: ConnectorStatus,
    #[serde(rename = "tested_at_time", skip_serializing_if = "Option::is_none")]
    pub tested_at_time: Option<String>,
    #[serde(rename = "last_tested_at_time", skip_serializing_if = "Option::is_none")]
    pub last_tested_at_time: Option<String>,
    #[serde(rename = "last_connected_at_time", skip_serializing_if = "Option::is_none")]
    pub last_connected_at_time: Option<String>,
    #[serde(rename = "last_alert_sent_time", skip_serializing_if = "Option::is_none")]
    pub last_alert_sent_time: Option<String>,
}

/// Activity details for a connector
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityDetails {
    #[serde(rename = "lastActivityTime", skip_serializing_if = "Option::is_none")]
    pub last_activity_time: Option<i64>,
}

/// Activity details with human-readable timestamps
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityDetailsWithHumanTime {
    #[serde(flatten)]
    pub activity: ActivityDetails,
    #[serde(rename = "last_activity_time", skip_serializing_if = "Option::is_none")]
    pub last_activity_time_str: Option<String>,
}

/// Detailed connector information
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

/// Connector detail with human-readable timestamps
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorDetailWithHumanTime {
    #[serde(flatten)]
    pub detail: ConnectorDetail,
    #[serde(rename = "created_at_time")]
    pub created_at_time: String,
    #[serde(rename = "last_modified_at_time")]
    pub last_modified_at_time: String,
    pub status: ConnectorStatusWithHumanTime,
    #[serde(rename = "activityDetails")]
    pub activity_details: ActivityDetailsWithHumanTime,
}

/// Request body for listing connectors
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
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

impl ConnectorStatusWithHumanTime {
    pub fn from_status(status: ConnectorStatus) -> Self {
        Self {
            tested_at_time: status.tested_at.and_then(unix_millis_to_rfc3339),
            last_tested_at_time: status.last_tested_at.and_then(unix_millis_to_rfc3339),
            last_connected_at_time: status.last_connected_at.and_then(unix_millis_to_rfc3339),
            last_alert_sent_time: status.last_alert_sent.and_then(unix_millis_to_rfc3339),
            status,
        }
    }
}

impl ActivityDetailsWithHumanTime {
    pub fn from_activity(activity: ActivityDetails) -> Self {
        Self {
            last_activity_time_str: activity.last_activity_time.and_then(unix_millis_to_rfc3339),
            activity,
        }
    }
}

impl ConnectorDetailWithHumanTime {
    pub fn from_detail(detail: ConnectorDetail) -> Self {
        Self {
            created_at_time: unix_millis_to_rfc3339(detail.created_at)
                .unwrap_or_else(|| "Unknown".to_string()),
            last_modified_at_time: unix_millis_to_rfc3339(detail.last_modified_at)
                .unwrap_or_else(|| "Unknown".to_string()),
            status: ConnectorStatusWithHumanTime::from_status(detail.status.clone()),
            activity_details: ActivityDetailsWithHumanTime::from_activity(detail.activity_details.clone()),
            detail,
        }
    }
}