//! Core types for tools and toolsets

use harness_mcp_proto::{Tool, ToolContent, CallToolRequest, CallToolResult};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

/// Tool handler function type
pub type ToolHandler = Box<dyn Fn(CallToolRequest) -> Result<CallToolResult, crate::error::ServerError> + Send + Sync>;

/// Tool definition with handler
pub struct ServerTool {
    pub tool: Tool,
    pub handler: ToolHandler,
}

impl ServerTool {
    /// Create a new server tool
    pub fn new(tool: Tool, handler: ToolHandler) -> Self {
        Self { tool, handler }
    }
}

/// Toolset definition
#[derive(Debug, Clone)]
pub struct Toolset {
    pub name: String,
    pub description: String,
    pub enabled: bool,
    pub read_only: bool,
    pub read_tools: Vec<String>,  // Tool names
    pub write_tools: Vec<String>, // Tool names
}

impl Toolset {
    /// Create a new toolset
    pub fn new(name: impl Into<String>, description: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            description: description.into(),
            enabled: false,
            read_only: false,
            read_tools: Vec::new(),
            write_tools: Vec::new(),
        }
    }

    /// Enable the toolset
    pub fn enable(mut self) -> Self {
        self.enabled = true;
        self
    }

    /// Set read-only mode
    pub fn read_only(mut self) -> Self {
        self.read_only = true;
        self
    }

    /// Add read tools
    pub fn with_read_tools(mut self, tools: Vec<String>) -> Self {
        self.read_tools = tools;
        self
    }

    /// Add write tools
    pub fn with_write_tools(mut self, tools: Vec<String>) -> Self {
        self.write_tools = tools;
        self
    }

    /// Get active tool names based on read-only mode
    pub fn get_active_tools(&self) -> Vec<String> {
        if !self.enabled {
            return Vec::new();
        }

        let mut tools = self.read_tools.clone();
        if !self.read_only {
            tools.extend(self.write_tools.clone());
        }
        tools
    }
}

/// Toolset group for managing multiple toolsets
#[derive(Debug, Clone)]
pub struct ToolsetGroup {
    pub toolsets: HashMap<String, Toolset>,
    pub everything_on: bool,
    pub read_only: bool,
}

impl ToolsetGroup {
    /// Create a new toolset group
    pub fn new(read_only: bool) -> Self {
        Self {
            toolsets: HashMap::new(),
            everything_on: false,
            read_only,
        }
    }

    /// Add a toolset to the group
    pub fn add_toolset(&mut self, mut toolset: Toolset) {
        if self.read_only {
            toolset.read_only = true;
        }
        self.toolsets.insert(toolset.name.clone(), toolset);
    }

    /// Enable toolsets by name
    pub fn enable_toolsets(&mut self, names: &[String]) -> Result<(), crate::error::ServerError> {
        if names.is_empty() {
            return self.enable_toolset("default");
        }

        for name in names {
            if name == "all" {
                self.everything_on = true;
                break;
            }
            self.enable_toolset(name)?;
        }

        if self.everything_on {
            for name in self.toolsets.keys().cloned().collect::<Vec<_>>() {
                self.enable_toolset(&name)?;
            }
        }

        Ok(())
    }

    /// Enable a specific toolset
    pub fn enable_toolset(&mut self, name: &str) -> Result<(), crate::error::ServerError> {
        let toolset = self.toolsets.get_mut(name)
            .ok_or_else(|| crate::error::ServerError::Tool(format!("Toolset '{}' does not exist", name)))?;

        if !toolset.enabled {
            toolset.enabled = true;
            tracing::info!("Toolset enabled: {}", name);
        }

        Ok(())
    }

    /// Check if a toolset is enabled
    pub fn is_enabled(&self, name: &str) -> bool {
        if self.everything_on {
            return true;
        }

        self.toolsets.get(name)
            .map(|t| t.enabled)
            .unwrap_or(false)
    }

    /// Get all enabled toolsets
    pub fn get_enabled_toolsets(&self) -> Vec<&Toolset> {
        self.toolsets.values()
            .filter(|t| t.enabled)
            .collect()
    }
}

/// Tool parameter definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolParameter {
    pub name: String,
    pub description: Option<String>,
    pub required: bool,
    pub parameter_type: ParameterType,
    pub default_value: Option<serde_json::Value>,
}

/// Parameter types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ParameterType {
    String,
    Number,
    Boolean,
    Array,
    Object,
}

/// Tool builder for creating tools with parameters
pub struct ToolBuilder {
    name: String,
    description: Option<String>,
    parameters: Vec<ToolParameter>,
}

impl ToolBuilder {
    /// Create a new tool builder
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            description: None,
            parameters: Vec::new(),
        }
    }

    /// Set description
    pub fn description(mut self, description: impl Into<String>) -> Self {
        self.description = Some(description.into());
        self
    }

    /// Add a string parameter
    pub fn string_param(mut self, name: impl Into<String>, description: impl Into<String>, required: bool) -> Self {
        self.parameters.push(ToolParameter {
            name: name.into(),
            description: Some(description.into()),
            required,
            parameter_type: ParameterType::String,
            default_value: None,
        });
        self
    }

    /// Add a number parameter
    pub fn number_param(mut self, name: impl Into<String>, description: impl Into<String>, required: bool) -> Self {
        self.parameters.push(ToolParameter {
            name: name.into(),
            description: Some(description.into()),
            required,
            parameter_type: ParameterType::Number,
            default_value: None,
        });
        self
    }

    /// Add a boolean parameter
    pub fn boolean_param(mut self, name: impl Into<String>, description: impl Into<String>, required: bool) -> Self {
        self.parameters.push(ToolParameter {
            name: name.into(),
            description: Some(description.into()),
            required,
            parameter_type: ParameterType::Boolean,
            default_value: None,
        });
        self
    }

    /// Build the tool
    pub fn build(self) -> Tool {
        let mut properties = serde_json::Map::new();
        let mut required = Vec::new();

        for param in &self.parameters {
            let mut param_schema = serde_json::Map::new();
            
            match param.parameter_type {
                ParameterType::String => {
                    param_schema.insert("type".to_string(), serde_json::Value::String("string".to_string()));
                }
                ParameterType::Number => {
                    param_schema.insert("type".to_string(), serde_json::Value::String("number".to_string()));
                }
                ParameterType::Boolean => {
                    param_schema.insert("type".to_string(), serde_json::Value::String("boolean".to_string()));
                }
                ParameterType::Array => {
                    param_schema.insert("type".to_string(), serde_json::Value::String("array".to_string()));
                }
                ParameterType::Object => {
                    param_schema.insert("type".to_string(), serde_json::Value::String("object".to_string()));
                }
            }

            if let Some(desc) = &param.description {
                param_schema.insert("description".to_string(), serde_json::Value::String(desc.clone()));
            }

            if let Some(default) = &param.default_value {
                param_schema.insert("default".to_string(), default.clone());
            }

            properties.insert(param.name.clone(), serde_json::Value::Object(param_schema));

            if param.required {
                required.push(param.name.clone());
            }
        }

        let mut input_schema = serde_json::Map::new();
        input_schema.insert("type".to_string(), serde_json::Value::String("object".to_string()));
        input_schema.insert("properties".to_string(), serde_json::Value::Object(properties));
        
        if !required.is_empty() {
            input_schema.insert("required".to_string(), serde_json::Value::Array(
                required.into_iter().map(serde_json::Value::String).collect()
            ));
        }

        Tool {
            name: self.name,
            description: self.description,
            input_schema: serde_json::Value::Object(input_schema),
        }
    }
}

/// Helper function to create text tool content
pub fn text_content(text: impl Into<String>) -> ToolContent {
    ToolContent::Text {
        text: text.into(),
    }
}

/// Helper function to create error tool result
pub fn error_result(message: impl Into<String>) -> CallToolResult {
    CallToolResult {
        content: vec![text_content(message.into())],
        is_error: Some(true),
    }
}

/// Helper function to create success tool result
pub fn success_result(content: Vec<ToolContent>) -> CallToolResult {
    CallToolResult {
        content,
        is_error: Some(false),
    }
}

/// Helper function to extract required parameter from tool request
pub fn required_param<T>(request: &CallToolRequest, name: &str) -> Result<T, crate::error::ServerError>
where
    T: serde::de::DeserializeOwned,
{
    let args = request.arguments.as_ref()
        .ok_or_else(|| crate::error::ServerError::InvalidRequest("Missing arguments".to_string()))?;

    let value = args.get(name)
        .ok_or_else(|| crate::error::ServerError::InvalidRequest(format!("Missing required parameter: {}", name)))?;

    serde_json::from_value(value.clone())
        .map_err(|e| crate::error::ServerError::InvalidRequest(format!("Invalid parameter '{}': {}", name, e)))
}

/// Helper function to extract optional parameter from tool request
pub fn optional_param<T>(request: &CallToolRequest, name: &str) -> Result<Option<T>, crate::error::ServerError>
where
    T: serde::de::DeserializeOwned,
{
    let args = request.arguments.as_ref();
    
    if let Some(args) = args {
        if let Some(value) = args.get(name) {
            let parsed = serde_json::from_value(value.clone())
                .map_err(|e| crate::error::ServerError::InvalidRequest(format!("Invalid parameter '{}': {}", name, e)))?;
            return Ok(Some(parsed));
        }
    }
    
    Ok(None)
}