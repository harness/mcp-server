use serde::{Deserialize, Serialize};
use std::fmt;

/// Transport protocol for the MCP server
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
        match s {
            "http" => TransportType::Http,
            _ => TransportType::Stdio,
        }
    }
}

/// Log format for the MCP server
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogFormatType {
    /// Text log format
    Text,
    /// JSON log format
    Json,
}

impl fmt::Display for LogFormatType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            LogFormatType::Text => write!(f, "text"),
            LogFormatType::Json => write!(f, "json"),
        }
    }
}

impl From<&str> for LogFormatType {
    fn from(s: &str) -> Self {
        match s {
            "json" => LogFormatType::Json,
            _ => LogFormatType::Text,
        }
    }
}

/// License status enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum LicenseStatus {
    Active,
    Inactive,
    Expired,
}

impl fmt::Display for LicenseStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            LicenseStatus::Active => write!(f, "ACTIVE"),
            LicenseStatus::Inactive => write!(f, "INACTIVE"),
            LicenseStatus::Expired => write!(f, "EXPIRED"),
        }
    }
}