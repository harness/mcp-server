//! Connector service client

use crate::{
    client::HarnessClient,
    error::Result,
    types::{Scope, Entity, ListResponse, ConnectorCatalogueItem, Pagination},
};
use serde::{Deserialize, Serialize};

/// Connector service client
pub struct ConnectorService {
    client: HarnessClient,
}

impl ConnectorService {
    /// Create a new connector service client
    pub fn new(client: HarnessClient) -> Self {
        Self { client }
    }

    /// List connector catalogue
    pub async fn list_catalogue(&self, scope: &Scope) -> Result<ListResponse<ConnectorCatalogueItem>> {
        let mut request = self.client.get("/ng/api/connectors/catalogue").await?;
        request = self.client.add_scope_params(request, scope);

        let response = self.client.execute_with_retry(request).await?;
        let list_response: ListResponse<ConnectorCatalogueItem> = response.json().await?;
        Ok(list_response)
    }

    /// List connectors
    pub async fn list(&self, scope: &Scope, pagination: Option<Pagination>, filter: Option<ConnectorFilter>) -> Result<ListResponse<ConnectorListItem>> {
        let mut request = self.client.get("/ng/api/connectors").await?;
        request = self.client.add_scope_params(request, scope);

        if let Some(pagination) = pagination {
            if let Some(page) = pagination.page {
                request = request.query(&[("page", page.to_string())]);
            }
            if let Some(size) = pagination.size {
                request = request.query(&[("size", size.to_string())]);
            }
            if let Some(sort) = pagination.sort {
                request = request.query(&[("sort", sort)]);
            }
        }

        if let Some(filter) = filter {
            if let Some(connector_type) = filter.connector_type {
                request = request.query(&[("type", connector_type)]);
            }
            if let Some(category) = filter.category {
                request = request.query(&[("category", category)]);
            }
            if let Some(search_term) = filter.search_term {
                request = request.query(&[("searchTerm", search_term)]);
            }
        }

        let response = self.client.execute_with_retry(request).await?;
        let list_response: ListResponse<ConnectorListItem> = response.json().await?;
        Ok(list_response)
    }

    /// Get a specific connector
    pub async fn get(&self, scope: &Scope, connector_id: &str) -> Result<Entity<ConnectorDetail>> {
        let path = format!("/ng/api/connectors/{}", connector_id);
        let mut request = self.client.get(&path).await?;
        request = self.client.add_scope_params(request, scope);

        let response = self.client.execute_with_retry(request).await?;
        let entity: Entity<ConnectorDetail> = response.json().await?;
        Ok(entity)
    }

    /// Create a new connector
    pub async fn create(&self, scope: &Scope, connector: ConnectorCreateRequest) -> Result<Entity<ConnectorDetail>> {
        let mut request = self.client.post("/ng/api/connectors").await?;
        request = self.client.add_scope_params(request, scope);
        request = request.json(&connector);

        let response = self.client.execute_with_retry(request).await?;
        let entity: Entity<ConnectorDetail> = response.json().await?;
        Ok(entity)
    }

    /// Update a connector
    pub async fn update(&self, scope: &Scope, connector_id: &str, connector: ConnectorUpdateRequest) -> Result<Entity<ConnectorDetail>> {
        let path = format!("/ng/api/connectors/{}", connector_id);
        let mut request = self.client.put(&path).await?;
        request = self.client.add_scope_params(request, scope);
        request = request.json(&connector);

        let response = self.client.execute_with_retry(request).await?;
        let entity: Entity<ConnectorDetail> = response.json().await?;
        Ok(entity)
    }

    /// Delete a connector
    pub async fn delete(&self, scope: &Scope, connector_id: &str) -> Result<()> {
        let path = format!("/ng/api/connectors/{}", connector_id);
        let mut request = self.client.delete(&path).await?;
        request = self.client.add_scope_params(request, scope);

        let _response = self.client.execute_with_retry(request).await?;
        Ok(())
    }

    /// Test connector connectivity
    pub async fn test_connection(&self, scope: &Scope, connector_id: &str) -> Result<Entity<ConnectorTestResult>> {
        let path = format!("/ng/api/connectors/{}/test-connection", connector_id);
        let mut request = self.client.post(&path).await?;
        request = self.client.add_scope_params(request, scope);

        let response = self.client.execute_with_retry(request).await?;
        let entity: Entity<ConnectorTestResult> = response.json().await?;
        Ok(entity)
    }
}

/// Connector filter options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorFilter {
    #[serde(rename = "type")]
    pub connector_type: Option<String>,
    pub category: Option<String>,
    #[serde(rename = "searchTerm")]
    pub search_term: Option<String>,
}

/// Connector list item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorListItem {
    pub connector: Option<ConnectorSummary>,
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
    pub git_details: Option<crate::types::GitDetails>,
    #[serde(rename = "entityValidityDetails")]
    pub entity_validity_details: Option<crate::types::EntityValidityDetails>,
}

/// Connector summary
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorSummary {
    pub name: Option<String>,
    pub identifier: Option<String>,
    pub description: Option<String>,
    #[serde(rename = "orgIdentifier")]
    pub org_identifier: Option<String>,
    #[serde(rename = "projectIdentifier")]
    pub project_identifier: Option<String>,
    pub tags: Option<std::collections::HashMap<String, String>>,
    #[serde(rename = "type")]
    pub connector_type: Option<String>,
    pub spec: Option<serde_json::Value>,
}

/// Connector detail
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorDetail {
    pub connector: Option<ConnectorSummary>,
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
    pub git_details: Option<crate::types::GitDetails>,
    #[serde(rename = "entityValidityDetails")]
    pub entity_validity_details: Option<crate::types::EntityValidityDetails>,
}

/// Connector status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorStatus {
    pub status: Option<String>,
    #[serde(rename = "errorSummary")]
    pub error_summary: Option<String>,
    #[serde(rename = "testedAt")]
    pub tested_at: Option<i64>,
    #[serde(rename = "lastTestedAt")]
    pub last_tested_at: Option<i64>,
    #[serde(rename = "lastConnectedAt")]
    pub last_connected_at: Option<i64>,
}

/// Activity details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityDetails {
    #[serde(rename = "lastActivityTime")]
    pub last_activity_time: Option<i64>,
}

/// Connector create request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorCreateRequest {
    pub connector: ConnectorSummary,
}

/// Connector update request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorUpdateRequest {
    pub connector: ConnectorSummary,
}

/// Connector test result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorTestResult {
    pub status: Option<String>,
    #[serde(rename = "errorSummary")]
    pub error_summary: Option<String>,
    #[serde(rename = "testedAt")]
    pub tested_at: Option<i64>,
    pub errors: Option<Vec<ConnectorTestError>>,
}

/// Connector test error
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorTestError {
    pub reason: Option<String>,
    pub message: Option<String>,
    pub code: Option<i32>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::HarnessClient;

    #[tokio::test]
    async fn test_connector_service_creation() {
        let client = HarnessClient::with_api_key("pat.account123.token456.suffix").unwrap();
        let service = ConnectorService::new(client);
        
        // Just test that the service can be created
        assert!(true);
    }
}