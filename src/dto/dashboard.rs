use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Dashboard representation in Harness
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Dashboard {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    pub tags: Option<HashMap<String, String>>,
    #[serde(rename = "accountIdentifier")]
    pub account_identifier: String,
    #[serde(rename = "orgIdentifier")]
    pub org_identifier: Option<String>,
    #[serde(rename = "projectIdentifier")]
    pub project_identifier: Option<String>,
    #[serde(rename = "dashboardType")]
    pub dashboard_type: String,
    #[serde(rename = "dataSourceType")]
    pub data_source_type: String,
    pub tiles: Option<Vec<DashboardTile>>,
    #[serde(rename = "timeRange")]
    pub time_range: Option<TimeRange>,
    pub layout: Option<DashboardLayout>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<i64>,
    #[serde(rename = "lastModifiedAt")]
    pub last_modified_at: Option<i64>,
}

/// Dashboard tile representation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardTile {
    pub id: String,
    pub title: String,
    #[serde(rename = "type")]
    pub tile_type: String,
    pub query: Option<String>,
    pub visualization: Option<TileVisualization>,
    pub position: Option<TilePosition>,
    pub size: Option<TileSize>,
    pub filters: Option<HashMap<String, serde_json::Value>>,
}

/// Tile visualization settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TileVisualization {
    #[serde(rename = "type")]
    pub viz_type: String,
    pub options: Option<HashMap<String, serde_json::Value>>,
}

/// Tile position on dashboard
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TilePosition {
    pub x: i32,
    pub y: i32,
}

/// Tile size
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TileSize {
    pub width: i32,
    pub height: i32,
}

/// Dashboard layout configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardLayout {
    #[serde(rename = "gridSize")]
    pub grid_size: Option<GridSize>,
    pub responsive: Option<bool>,
}

/// Grid size for dashboard layout
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GridSize {
    pub columns: i32,
    pub rows: i32,
}

/// Time range for dashboard data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeRange {
    #[serde(rename = "type")]
    pub range_type: String,
    #[serde(rename = "startTime")]
    pub start_time: Option<i64>,
    #[serde(rename = "endTime")]
    pub end_time: Option<i64>,
    pub duration: Option<String>,
}

/// Dashboard data request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardDataRequest {
    #[serde(rename = "dashboardId")]
    pub dashboard_id: String,
    #[serde(rename = "timeRange")]
    pub time_range: Option<TimeRange>,
    pub filters: Option<HashMap<String, serde_json::Value>>,
    #[serde(rename = "tileIds")]
    pub tile_ids: Option<Vec<String>>,
}

/// Dashboard data response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardDataResponse {
    #[serde(rename = "dashboardId")]
    pub dashboard_id: String,
    pub data: HashMap<String, TileData>,
    #[serde(rename = "lastUpdated")]
    pub last_updated: i64,
}

/// Tile data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TileData {
    #[serde(rename = "tileId")]
    pub tile_id: String,
    pub data: serde_json::Value,
    pub status: String,
    pub error: Option<String>,
}