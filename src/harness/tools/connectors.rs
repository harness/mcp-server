use crate::config::Config;
use crate::harness::client::HarnessClient;
use crate::harness::common;
use crate::harness::tools::{params, results, schema};
use crate::types::{HarnessError, PaginationOptions, Scope};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

/// Connector service client for Harness API
pub struct ConnectorService {
    client: HarnessClient,
}

impl ConnectorService {
    pub fn new(client: HarnessClient) -> Self {
        Self { client }
    }

    /// List connector catalogue
    pub async fn list_connector_catalogue(&self, scope: &Scope) -> Result<ConnectorCatalogueResponse, HarnessError> {
        let path = format!("ng/api/connectors/catalogue?{}", build_scope_query(scope));

        let response = self.client
            .get(&path)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(HarnessError::Api(format!(
                "Failed to list connector catalogue: {}",
                response.status()
            )));
        }

        let catalogue_response: ConnectorCatalogueResponse = response.json().await?;
        Ok(catalogue_response)
    }

    /// Get connector details
    pub async fn get_connector(
        &self,
        scope: &Scope,
        connector_identifier: &str,
    ) -> Result<ConnectorDetailResponse, HarnessError> {
        let path = format!(
            "ng/api/connectors/{}?{}",
            connector_identifier,
            build_scope_query(scope)
        );

        let response = self.client
            .get(&path)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(HarnessError::Api(format!(
                "Failed to get connector: {}",
                response.status()
            )));
        }

        let connector_response: ConnectorDetailResponse = response.json().await?;
        Ok(connector_response)
    }

    /// List connectors with filtering
    pub async fn list_connectors(
        &self,
        scope: &Scope,
        options: &ConnectorListOptions,
    ) -> Result<ConnectorListResponse, HarnessError> {
        let mut path = format!("ng/api/connectors?{}", build_scope_query(scope));

        if let Some(search_term) = &options.search_term {
            path.push_str(&format!("&searchTerm={}", urlencoding::encode(search_term)));
        }

        if let Some(connector_types) = &options.connector_types {
            for connector_type in connector_types {
                path.push_str(&format!("&type={}", urlencoding::encode(connector_type)));
            }
        }

        if let Some(connectivity_statuses) = &options.connectivity_statuses {
            for status in connectivity_statuses {
                path.push_str(&format!("&connectivityStatus={}", urlencoding::encode(status)));
            }
        }

        if let Some(categories) = &options.categories {
            for category in categories {
                path.push_str(&format!("&category={}", urlencoding::encode(category)));
            }
        }

        if let Some(source_categories) = &options.source_categories {
            for source_category in source_categories {
                path.push_str(&format!("&sourceCategory={}", urlencoding::encode(source_category)));
            }
        }

        if let Some(page) = options.pagination.page {
            path.push_str(&format!("&page={}", page));
        }

        if let Some(size) = options.pagination.size {
            path.push_str(&format!("&size={}", size));
        }

        let response = self.client
            .get(&path)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(HarnessError::Api(format!(
                "Failed to list connectors: {}",
                response.status()
            )));
        }

        let list_response: ConnectorListResponse = response.json().await?;
        Ok(list_response)
    }
}

/// Connector data structures
#[derive(Debug, Serialize, Deserialize)]
pub struct ConnectorCatalogueItem {
    pub category: String,
    pub connector_type: String,
    pub display_name: String,
    pub description: Option<String>,
    pub icon_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConnectorCatalogueResponse {
    pub status: String,
    pub data: Vec<ConnectorCatalogueItem>,
}

#[derive(Debug, Serialize, Deserialize)]
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

#[derive(Debug, Serialize, Deserialize)]
pub struct Connector {
    pub name: String,
    pub identifier: String,
    pub description: Option<String>,
    pub org_identifier: Option<String>,
    pub project_identifier: Option<String>,
    pub tags: Option<HashMap<String, String>>,
    pub connector_type: String,
    pub spec: Value, // Connector-specific configuration
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConnectorStatus {
    pub status: String,
    pub error_summary: Option<String>,
    pub errors: Option<Vec<ConnectorError>>,
    pub tested_at: Option<i64>,
    pub last_tested_at: Option<i64>,
    pub last_connected_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConnectorError {
    pub reason: String,
    pub message: String,
    pub code: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ActivityDetails {
    pub last_activity_time: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitDetails {
    pub object_id: Option<String>,
    pub branch: Option<String>,
    pub repo_identifier: Option<String>,
    pub root_folder: Option<String>,
    pub file_path: Option<String>,
    pub repo_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EntityValidityDetails {
    pub valid: bool,
    pub invalid_yaml: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GovernanceMetadata {
    pub id: Option<String>,
    pub deny: Option<bool>,
    pub details: Option<Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConnectorDetailResponse {
    pub status: String,
    pub data: ConnectorDetail,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConnectorListResponse {
    pub status: String,
    pub data: ConnectorListData,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConnectorListData {
    pub content: Vec<ConnectorDetail>,
    pub page_info: PageInfo,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PageInfo {
    pub page: u32,
    pub size: u32,
    pub total: u64,
    pub total_pages: u32,
}

/// Options for listing connectors
#[derive(Debug, Default)]
pub struct ConnectorListOptions {
    pub search_term: Option<String>,
    pub connector_types: Option<Vec<String>>,
    pub connectivity_statuses: Option<Vec<String>>,
    pub categories: Option<Vec<String>>,
    pub source_categories: Option<Vec<String>>,
    pub pagination: PaginationOptions,
}

/// Connector tools implementation
pub struct ConnectorTools {
    service: ConnectorService,
    config: Config,
}

impl ConnectorTools {
    pub fn new(service: ConnectorService, config: Config) -> Self {
        Self { service, config }
    }

    /// List connector catalogue tool
    pub async fn list_connector_catalogue(&self, request: &Value) -> Result<Value, HarnessError> {
        let scope = common::fetch_scope(&self.config, request, false)?;

        let catalogue = self.service.list_connector_catalogue(&scope).await?;
        results::json_result(&serde_json::to_value(catalogue)?)
    }

    /// Get connector details tool
    pub async fn get_connector_details(&self, request: &Value) -> Result<Value, HarnessError> {
        let connector_identifier = params::required_param::<String>(request, "connector_identifier")?;
        let scope = common::fetch_scope(&self.config, request, false)?;

        let connector = self.service.get_connector(&scope, &connector_identifier).await?;
        
        // Convert to human-readable format with time fields
        let mut connector_detail = connector.data;
        
        // Convert timestamps to human-readable format if needed
        // This would be similar to the Go version's ToConnectorDetail function
        
        results::json_result(&serde_json::to_value(connector_detail)?)
    }

    /// List connectors tool
    pub async fn list_connectors(&self, request: &Value) -> Result<Value, HarnessError> {
        let scope = common::fetch_scope(&self.config, request, false)?;
        let search_term = params::optional_param::<String>(request, "search_term")?;
        
        // Parse comma-separated strings into vectors
        let connector_types = params::optional_param::<String>(request, "connector_types")?
            .map(|s| parse_string_slice(&s));
        let connectivity_statuses = params::optional_param::<String>(request, "connectivity_statuses")?
            .map(|s| parse_string_slice(&s));
        let categories = params::optional_param::<String>(request, "categories")?
            .map(|s| parse_string_slice(&s));
        let source_categories = params::optional_param::<String>(request, "source_categories")?
            .map(|s| parse_string_slice(&s));
        
        let pagination = params::optional_param::<PaginationOptions>(request, "pagination")?
            .unwrap_or_default();

        let options = ConnectorListOptions {
            search_term,
            connector_types,
            connectivity_statuses,
            categories,
            source_categories,
            pagination,
        };

        let connectors = self.service.list_connectors(&scope, &options).await?;
        results::json_result(&serde_json::to_value(connectors)?)
    }
}

/// Helper function to build scope query parameters
fn build_scope_query(scope: &Scope) -> String {
    let mut params = vec![format!("accountIdentifier={}", scope.account_id)];
    
    if let Some(org_id) = &scope.org_id {
        params.push(format!("orgIdentifier={}", org_id));
    }
    
    if let Some(project_id) = &scope.project_id {
        params.push(format!("projectIdentifier={}", project_id));
    }
    
    params.join("&")
}

/// Parse a comma-separated string into a vector of strings
fn parse_string_slice(input: &str) -> Vec<String> {
    if input.is_empty() {
        return Vec::new();
    }
    
    input
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect()
}