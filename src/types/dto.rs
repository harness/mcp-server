use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Common DTOs converted from Go structs with appropriate Rust derives

/// Connector catalogue item
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ConnectorCatalogueItem {
    pub category: String,
    pub connector_type: String,
    pub display_name: String,
    pub description: Option<String>,
    pub icon_url: Option<String>,
}

/// Connector detail with all metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorDetail {
    pub connector: Connector,
    pub created_at: Option<i64>,
    pub last_modified_at: Option<i64>,
    pub status: Option<ConnectorStatus>,
    pub activity_details: Option<ActivityDetails>,
    pub harness_managed: Option<bool>,
    pub git_details: Option<GitDetails>,
    pub entity_validity_details: Option<EntityValidityDetails>,
    pub governance_metadata: Option<GovernanceMetadata>,
}

/// Connector detail with human-readable time fields
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorDetailWithHumanTime {
    pub connector: Connector,
    pub created_at: Option<String>,
    pub last_modified_at: Option<String>,
    pub status: Option<ConnectorStatus>,
    pub activity_details: Option<ActivityDetails>,
    pub harness_managed: Option<bool>,
    pub git_details: Option<GitDetails>,
    pub entity_validity_details: Option<EntityValidityDetails>,
    pub governance_metadata: Option<GovernanceMetadata>,
}

/// Core connector definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Connector {
    pub name: String,
    pub identifier: String,
    pub description: Option<String>,
    pub org_identifier: Option<String>,
    pub project_identifier: Option<String>,
    pub tags: Option<HashMap<String, String>>,
    pub connector_type: String,
    pub spec: serde_json::Value, // Connector-specific configuration
}

/// Entity validity details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityValidityDetails {
    pub valid: bool,
    pub invalid_yaml: Option<String>,
}

/// Connector status information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorStatus {
    pub status: String,
    pub error_summary: Option<String>,
    pub errors: Option<Vec<ConnectorError>>,
    pub tested_at: Option<i64>,
    pub last_tested_at: Option<i64>,
    pub last_connected_at: Option<i64>,
}

/// Connector error details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorError {
    pub reason: String,
    pub message: String,
    pub code: Option<i32>,
}

/// Activity details for connectors
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityDetails {
    pub last_activity_time: Option<i64>,
}

/// Git details for connectors stored in Git
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitDetails {
    pub object_id: Option<String>,
    pub branch: Option<String>,
    pub repo_identifier: Option<String>,
    pub root_folder: Option<String>,
    pub file_path: Option<String>,
    pub repo_name: Option<String>,
}

/// Governance metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GovernanceMetadata {
    pub id: Option<String>,
    pub deny: Option<bool>,
    pub details: Option<serde_json::Value>,
}

/// Pipeline definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pipeline {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    pub tags: Option<HashMap<String, String>>,
    pub version: Option<i64>,
    pub yaml: Option<String>,
}

/// Pipeline execution details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineExecution {
    pub plan_execution_id: String,
    pub pipeline_identifier: String,
    pub status: String,
    pub start_ts: Option<i64>,
    pub end_ts: Option<i64>,
    pub created_at: Option<i64>,
    pub trigger_type: Option<String>,
    pub execution_trigger_info: Option<serde_json::Value>,
}

/// Service definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Service {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    pub tags: Option<HashMap<String, String>>,
    pub version: Option<i64>,
}

/// Environment definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Environment {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    pub tags: Option<HashMap<String, String>>,
    pub environment_type: String,
    pub version: Option<i64>,
}

/// Infrastructure definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Infrastructure {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    pub tags: Option<HashMap<String, String>>,
    pub environment_ref: String,
    pub deployment_type: String,
    pub version: Option<i64>,
}

/// Repository definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Repository {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    pub url: String,
    pub connection_type: String,
    pub visibility: String,
}

/// Pull request definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PullRequest {
    pub number: i32,
    pub title: String,
    pub description: Option<String>,
    pub state: String,
    pub source_branch: String,
    pub target_branch: String,
    pub author: Option<String>,
    pub created: Option<i64>,
    pub updated: Option<i64>,
}

/// Template definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Template {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    pub tags: Option<HashMap<String, String>>,
    pub template_type: String,
    pub version: String,
}

/// IDP entity definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdpEntity {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    pub entity_type: String,
    pub tags: Option<HashMap<String, String>>,
    pub metadata: Option<serde_json::Value>,
}

/// Scorecard definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Scorecard {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    pub tags: Option<HashMap<String, String>>,
    pub checks: Option<Vec<serde_json::Value>>,
}

/// Audit event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEvent {
    pub id: String,
    pub timestamp: i64,
    pub user_id: String,
    pub action: String,
    pub resource_type: String,
    pub resource_identifier: String,
    pub details: Option<serde_json::Value>,
}

/// License information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicenseInfo {
    pub account_id: String,
    pub module_licenses: HashMap<String, bool>,
    pub is_valid: bool,
}

/// OPA content for SCS
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpaContent {
    pub content: String,
    pub file_name: String,
}

/// File content
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileContent {
    pub content: String,
    pub path: String,
    pub encoding: Option<String>,
}

/// Conversion utilities
impl ConnectorDetail {
    /// Convert to human-readable time format
    pub fn to_human_time(&self) -> ConnectorDetailWithHumanTime {
        ConnectorDetailWithHumanTime {
            connector: self.connector.clone(),
            created_at: self.created_at.map(|ts| format_timestamp(ts)),
            last_modified_at: self.last_modified_at.map(|ts| format_timestamp(ts)),
            status: self.status.clone(),
            activity_details: self.activity_details.clone(),
            harness_managed: self.harness_managed,
            git_details: self.git_details.clone(),
            entity_validity_details: self.entity_validity_details.clone(),
            governance_metadata: self.governance_metadata.clone(),
        }
    }
}

/// Format timestamp to human-readable string
fn format_timestamp(timestamp: i64) -> String {
    use chrono::{DateTime, Utc};
    
    if let Some(dt) = DateTime::from_timestamp(timestamp / 1000, ((timestamp % 1000) * 1_000_000) as u32) {
        dt.format("%Y-%m-%d %H:%M:%S UTC").to_string()
    } else {
        timestamp.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_connector_serialization() {
        let connector = Connector {
            name: "test-connector".to_string(),
            identifier: "test_connector".to_string(),
            description: Some("Test connector".to_string()),
            org_identifier: Some("test_org".to_string()),
            project_identifier: Some("test_project".to_string()),
            tags: Some(HashMap::from([("env".to_string(), "test".to_string())])),
            connector_type: "Git".to_string(),
            spec: serde_json::json!({"url": "https://github.com/test/repo"}),
        };

        let serialized = serde_json::to_string(&connector).unwrap();
        let deserialized: Connector = serde_json::from_str(&serialized).unwrap();
        
        assert_eq!(connector.name, deserialized.name);
        assert_eq!(connector.identifier, deserialized.identifier);
        assert_eq!(connector.connector_type, deserialized.connector_type);
    }

    #[test]
    fn test_format_timestamp() {
        let timestamp = 1640995200000; // 2022-01-01 00:00:00 UTC
        let formatted = format_timestamp(timestamp);
        assert!(formatted.contains("2022-01-01"));
    }

    #[test]
    fn test_connector_detail_to_human_time() {
        let detail = ConnectorDetail {
            connector: Connector {
                name: "test".to_string(),
                identifier: "test".to_string(),
                description: None,
                org_identifier: None,
                project_identifier: None,
                tags: None,
                connector_type: "Git".to_string(),
                spec: serde_json::json!({}),
            },
            created_at: Some(1640995200000),
            last_modified_at: Some(1640995200000),
            status: None,
            activity_details: None,
            harness_managed: None,
            git_details: None,
            entity_validity_details: None,
            governance_metadata: None,
        };

        let human_time = detail.to_human_time();
        assert!(human_time.created_at.is_some());
        assert!(human_time.created_at.unwrap().contains("2022-01-01"));
    }
}