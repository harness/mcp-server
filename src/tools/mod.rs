pub mod registry;
pub mod pipelines;
pub mod connectors;
pub mod common;

pub use registry::ToolsetRegistry;

use crate::config::Config;
use crate::error::Result;
use crate::mcp::{Tool, ToolCall, ToolResult, ToolContent};
use async_trait::async_trait;
use serde_json::Value;
use std::collections::HashMap;

#[async_trait]
pub trait ToolHandler: Send + Sync {
    async fn handle(&self, call: ToolCall, config: &Config) -> Result<ToolResult>;
}

pub fn create_text_result(text: String) -> ToolResult {
    ToolResult {
        content: vec![ToolContent::Text { text }],
        is_error: None,
    }
}

pub fn create_error_result(error: String) -> ToolResult {
    ToolResult {
        content: vec![ToolContent::Text { text: error }],
        is_error: Some(true),
    }
}

pub fn get_required_param<T>(params: &HashMap<String, Value>, name: &str) -> Result<T>
where
    T: serde::de::DeserializeOwned,
{
    let value = params.get(name)
        .ok_or_else(|| crate::error::HarnessError::MissingParameter(name.to_string()))?;
    
    serde_json::from_value(value.clone())
        .map_err(|e| crate::error::HarnessError::InvalidParameter(
            format!("Parameter '{}': {}", name, e)
        ))
}

pub fn get_optional_param<T>(params: &HashMap<String, Value>, name: &str) -> Result<Option<T>>
where
    T: serde::de::DeserializeOwned,
{
    match params.get(name) {
        Some(value) => {
            let result = serde_json::from_value(value.clone())
                .map_err(|e| crate::error::HarnessError::InvalidParameter(
                    format!("Parameter '{}': {}", name, e)
                ))?;
            Ok(Some(result))
        }
        None => Ok(None),
    }
}