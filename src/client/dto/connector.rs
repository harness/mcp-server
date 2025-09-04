//! Connector DTOs

use serde::{Deserialize, Serialize};

/// Connector information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Connector {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    pub tags: std::collections::HashMap<String, String>,
    pub connector_type: String,
}

/// Connector list response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorListResponse {
    pub status: String,
    pub data: Option<ConnectorListData>,
}

/// Connector list data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorListData {
    pub content: Vec<Connector>,
    pub total_elements: i64,
}

/// Connector catalogue item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorCatalogueItem {
    pub category: String,
    pub connector_type: String,
    pub name: String,
    pub description: Option<String>,
}

/// Connector catalogue response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorCatalogueResponse {
    pub status: String,
    pub data: Vec<ConnectorCatalogueItem>,
}