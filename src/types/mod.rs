//! Common types and enums used throughout the application

pub mod config;
pub mod error;

pub use config::*;
pub use error::*;

/// Transport type for the MCP server
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TransportType {
    Http,
    Stdio,
}

impl std::fmt::Display for TransportType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TransportType::Http => write!(f, "http"),
            TransportType::Stdio => write!(f, "stdio"),
        }
    }
}