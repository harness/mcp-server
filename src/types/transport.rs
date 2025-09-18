use serde::{Deserialize, Serialize};
use std::fmt;

/// Transport type for the MCP server
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TransportType {
    /// Standard input/output transport
    Stdio,
    /// HTTP transport
    Http,
}

impl fmt::Display for TransportType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            TransportType::Stdio => write!(f, "stdio"),
            TransportType::Http => write!(f, "http"),
        }
    }
}

impl From<&str> for TransportType {
    fn from(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "http" => TransportType::Http,
            _ => TransportType::Stdio,
        }
    }
}

impl Default for TransportType {
    fn default() -> Self {
        TransportType::Stdio
    }
}