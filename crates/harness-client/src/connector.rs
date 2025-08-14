use crate::client::{HarnessClient, ClientError, HarnessResponse, PaginatedResponse};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Connector client for Harness Connector service
/// Migrated from Go client.ConnectorService
#[derive(Debug, Clone)]
pub struct ConnectorClient {
    client: HarnessClient,
}

impl ConnectorClient {
    /// Create a new connector client
    pub fn new(client: HarnessClient) -> Self {
        Self { client }
    }

    /// List connector catalogue
    pub async fn list_connector_catalogue(
        &self,
        account_id: &str,
    ) -> Result<Vec<ConnectorCatalogueItem>, ClientError> {
        let path = format!("v1/connectors/catalogue?accountIdentifier={}", account_id);

        let request = self.client.get(&path);
        let response: HarnessResponse<Vec<ConnectorCatalogueItem>> = 
            self.client.execute_request(request).await?;

        response.data.ok_or_else(|| ClientError::ParseError("No data in response".to_string()))
    }

    /// Get connector details
    pub async fn get_connector_details(
        &self,
        account_id: &str,
        org_id: Option<&str>,
        project_id: Option<&str>,
        connector_id: &str,
    ) -> Result<Connector, ClientError> {
        let mut path = format!(
            "v1/connectors/{}?accountIdentifier={}",
            connector_id, account_id
        );

        if let Some(org) = org_id {
            path.push_str(&format!("&orgIdentifier={}", org));
        }
        if let Some(project) = project_id {
            path.push_str(&format!("&projectIdentifier={}", project));
        }

        let request = self.client.get(&path);
        let response: HarnessResponse<ConnectorResponse> = self.client.execute_request(request).await?;

        response.data
            .and_then(|data| data.connector)
            .ok_or_else(|| ClientError::ParseError("No connector data in response".to_string()))
    }

    /// List connectors
    pub async fn list_connectors(
        &self,
        account_id: &str,
        org_id: Option<&str>,
        project_id: Option<&str>,
        page: Option<i32>,
        size: Option<i32>,
    ) -> Result<PaginatedResponse<Connector>, ClientError> {
        let mut path = format!("v1/connectors?accountIdentifier={}", account_id);

        if let Some(org) = org_id {
            path.push_str(&format!("&orgIdentifier={}", org));
        }
        if let Some(project) = project_id {
            path.push_str(&format!("&projectIdentifier={}", project));
        }
        if let Some(p) = page {
            path.push_str(&format!("&page={}", p));
        }
        if let Some(s) = size {
            path.push_str(&format!("&size={}", s));
        }

        let request = self.client.get(&path);
        let response: HarnessResponse<PaginatedResponse<Connector>> = 
            self.client.execute_request(request).await?;

        response.data.ok_or_else(|| ClientError::ParseError("No data in response".to_string()))
    }
}

/// Connector catalogue item
/// Migrated from Go connector structures
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorCatalogueItem {
    pub category: String,
    #[serde(rename = "type")]
    pub connector_type: String,
    pub display_name: String,
    pub description: Option<String>,
    pub icon_url: Option<String>,
    pub enabled: Option<bool>,
}

/// Connector response wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorResponse {
    pub connector: Option<Connector>,
    pub created_at: Option<i64>,
    pub last_modified_at: Option<i64>,
    pub status: Option<ConnectorStatus>,
    pub activity_details: Option<ActivityDetails>,
    pub harness_managed: Option<bool>,
    pub git_details: Option<GitDetails>,
    pub entity_validity_details: Option<EntityValidityDetails>,
    pub governance_metadata: Option<GovernanceMetadata>,
}

/// Connector data structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Connector {
    pub name: String,
    pub identifier: String,
    pub description: Option<String>,
    pub org_identifier: Option<String>,
    pub project_identifier: Option<String>,
    #[serde(rename = "type")]
    pub connector_type: String,
    pub spec: serde_json::Value,
    pub tags: Option<HashMap<String, String>>,
}

/// Connector status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorStatus {
    pub status: String,
    pub error_summary: Option<String>,
    pub errors: Option<Vec<ConnectorError>>,
    pub tested_at: Option<i64>,
    pub last_tested_at: Option<i64>,
    pub last_connected_at: Option<i64>,
}

/// Connector error
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorError {
    pub reason: Option<String>,
    pub message: Option<String>,
    pub code: Option<i32>,
}

/// Activity details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityDetails {
    pub last_activity_time: Option<i64>,
}

/// Git details for connector
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitDetails {
    pub object_id: Option<String>,
    pub branch: Option<String>,
    pub repo_identifier: Option<String>,
    pub root_folder: Option<String>,
    pub file_path: Option<String>,
    pub commit_id: Option<String>,
}

/// Entity validity details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityValidityDetails {
    pub valid: Option<bool>,
    pub invalid_yaml: Option<String>,
}

/// Governance metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GovernanceMetadata {
    pub id: Option<String>,
    pub deny: Option<bool>,
    pub details: Option<serde_json::Value>,
}