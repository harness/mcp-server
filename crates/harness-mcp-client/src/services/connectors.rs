//! Connector service client implementation

use crate::client::Client;
use crate::dto::{ListResponse, PaginationOptions, Scope};
use crate::error::{Error, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Connector definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Connector {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "type")]
    pub connector_type: String,
    pub spec: serde_json::Value,
    pub tags: Option<HashMap<String, String>>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<i64>,
    #[serde(rename = "lastModifiedAt")]
    pub last_modified_at: Option<i64>,
}

/// Connector catalogue item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorCatalogueItem {
    #[serde(rename = "type")]
    pub connector_type: String,
    pub name: String,
    pub description: Option<String>,
    pub category: String,
    pub icon: Option<String>,
}

/// Connector list options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorListOptions {
    #[serde(flatten)]
    pub pagination: PaginationOptions,
    pub search_term: Option<String>,
    #[serde(rename = "type")]
    pub connector_type: Option<String>,
    pub category: Option<String>,
}

/// Connector response wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorResponse {
    pub data: Connector,
}

/// Connector list response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorListResponse {
    pub data: ListResponse<Connector>,
}

/// Connector catalogue response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorCatalogueResponse {
    pub data: Vec<ConnectorCatalogueItem>,
}

/// Connector service client
#[derive(Clone)]
pub struct ConnectorService {
    client: Client,
}

impl ConnectorService {
    /// Create a new connector service client
    pub fn new(client: Client) -> Self {
        Self { client }
    }

    /// Get connector catalogue
    pub async fn get_catalogue(&self, scope: &Scope) -> Result<ConnectorCatalogueResponse> {
        let path = format!(
            "/ng/api/connectors/catalogue/orgs/{}/projects/{}",
            scope.org_id.as_deref().unwrap_or_default(),
            scope.project_id.as_deref().unwrap_or_default()
        );
        self.client.get(&path).await
    }

    /// Get a specific connector
    pub async fn get(&self, scope: &Scope, connector_id: &str) -> Result<ConnectorResponse> {
        let path = format!(
            "/ng/api/connectors/{}/orgs/{}/projects/{}",
            connector_id,
            scope.org_id.as_deref().unwrap_or_default(),
            scope.project_id.as_deref().unwrap_or_default()
        );
        self.client.get(&path).await
    }

    /// List connectors
    pub async fn list(
        &self,
        scope: &Scope,
        options: &ConnectorListOptions,
    ) -> Result<ConnectorListResponse> {
        let mut path = format!(
            "/ng/api/connectors/orgs/{}/projects/{}",
            scope.org_id.as_deref().unwrap_or_default(),
            scope.project_id.as_deref().unwrap_or_default()
        );

        // Add query parameters
        let mut query_params = Vec::new();
        if let Some(page) = options.pagination.page {
            query_params.push(format!("page={}", page));
        }
        if let Some(size) = options.pagination.size {
            query_params.push(format!("size={}", size));
        }
        if let Some(ref search_term) = options.search_term {
            query_params.push(format!("searchTerm={}", urlencoding::encode(search_term)));
        }
        if let Some(ref connector_type) = options.connector_type {
            query_params.push(format!("type={}", urlencoding::encode(connector_type)));
        }
        if let Some(ref category) = options.category {
            query_params.push(format!("category={}", urlencoding::encode(category)));
        }

        if !query_params.is_empty() {
            path.push('?');
            path.push_str(&query_params.join("&"));
        }

        self.client.get(&path).await
    }
}