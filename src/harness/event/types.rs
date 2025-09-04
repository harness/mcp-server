//! Event types for the Harness MCP server

use serde::{Deserialize, Serialize};

/// Generic event type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Event {
    pub event_type: EventType,
    pub payload: serde_json::Value,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

/// Event type enumeration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EventType {
    ToolExecution,
    ResourceAccess,
    Authentication,
    Error,
    Custom(String),
}

impl Event {
    pub fn new(event_type: EventType, payload: serde_json::Value) -> Self {
        Self {
            event_type,
            payload,
            timestamp: chrono::Utc::now(),
        }
    }
}