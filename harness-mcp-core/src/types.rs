use serde::{Deserialize, Serialize};

/// Common types used throughout the MCP server

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginationOptions {
    pub page: Option<u32>,
    pub size: Option<u32>,
}

impl Default for PaginationOptions {
    fn default() -> Self {
        Self {
            page: Some(0),
            size: Some(5),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginatedResponse<T> {
    pub data: Vec<T>,
    pub page: u32,
    pub size: u32,
    pub total: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TransportType {
    Stdio,
    Http,
}

impl Default for TransportType {
    fn default() -> Self {
        Self::Stdio
    }
}