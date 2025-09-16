// Re-export MCP types from core crate
// This is a temporary solution until we properly structure the dependencies

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Tool definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tool {
    pub name: String,
    pub description: String,
    #[serde(rename = "inputSchema")]
    pub input_schema: ToolInputSchema,
}

/// Tool input schema
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolInputSchema {
    #[serde(rename = "type")]
    pub schema_type: String,
    pub properties: HashMap<String, ToolProperty>,
    pub required: Option<Vec<String>>,
}

/// Tool property
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolProperty {
    #[serde(rename = "type")]
    pub property_type: String,
    pub description: Option<String>,
    #[serde(rename = "enum")]
    pub enum_values: Option<Vec<String>>,
}

/// Tool result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResult {
    pub content: Vec<ToolContent>,
    #[serde(rename = "isError")]
    pub is_error: Option<bool>,
}

/// Tool content
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ToolContent {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "image")]
    Image { data: String, mime_type: String },
    #[serde(rename = "resource")]
    Resource { resource: ResourceReference },
}

/// Resource reference
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceReference {
    pub uri: String,
    pub text: Option<String>,
}

impl ToolResult {
    /// Create a successful text result
    pub fn text<S: Into<String>>(text: S) -> Self {
        Self {
            content: vec![ToolContent::Text { text: text.into() }],
            is_error: Some(false),
        }
    }

    /// Create an error result
    pub fn error<S: Into<String>>(message: S) -> Self {
        Self {
            content: vec![ToolContent::Text { text: message.into() }],
            is_error: Some(true),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tool_result_text() {
        let result = ToolResult::text("Hello, world!");
        assert_eq!(result.content.len(), 1);
        assert_eq!(result.is_error, Some(false));
        
        if let ToolContent::Text { text } = &result.content[0] {
            assert_eq!(text, "Hello, world!");
        } else {
            panic!("Expected text content");
        }
    }

    #[test]
    fn test_tool_result_error() {
        let result = ToolResult::error("Something went wrong");
        assert_eq!(result.content.len(), 1);
        assert_eq!(result.is_error, Some(true));
        
        if let ToolContent::Text { text } = &result.content[0] {
            assert_eq!(text, "Something went wrong");
        } else {
            panic!("Expected text content");
        }
    }
}