use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use async_trait::async_trait;
use crate::{Scope, ScopeRequirement};

/// Tool parameter definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolParameter {
    pub name: String,
    pub description: String,
    pub required: bool,
    pub parameter_type: ParameterType,
}

/// Parameter type enumeration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ParameterType {
    #[serde(rename = "string")]
    String {
        #[serde(skip_serializing_if = "Option::is_none")]
        default: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        enum_values: Option<Vec<String>>,
    },
    #[serde(rename = "integer")]
    Integer {
        #[serde(skip_serializing_if = "Option::is_none")]
        default: Option<i64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        min: Option<i64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        max: Option<i64>,
    },
    #[serde(rename = "boolean")]
    Boolean {
        #[serde(skip_serializing_if = "Option::is_none")]
        default: Option<bool>,
    },
    #[serde(rename = "array")]
    Array {
        items: Box<ParameterType>,
    },
    #[serde(rename = "object")]
    Object {
        properties: HashMap<String, ParameterType>,
    },
}

impl ToolParameter {
    /// Create a required string parameter
    pub fn string(name: &str, description: &str, required: bool) -> Self {
        Self {
            name: name.to_string(),
            description: description.to_string(),
            required,
            parameter_type: ParameterType::String {
                default: None,
                enum_values: None,
            },
        }
    }

    /// Create a string parameter with enum values
    pub fn string_enum(name: &str, description: &str, required: bool, values: Vec<String>) -> Self {
        Self {
            name: name.to_string(),
            description: description.to_string(),
            required,
            parameter_type: ParameterType::String {
                default: None,
                enum_values: Some(values),
            },
        }
    }

    /// Create an integer parameter
    pub fn integer(name: &str, description: &str, required: bool) -> Self {
        Self {
            name: name.to_string(),
            description: description.to_string(),
            required,
            parameter_type: ParameterType::Integer {
                default: None,
                min: None,
                max: None,
            },
        }
    }

    /// Create a boolean parameter
    pub fn boolean(name: &str, description: &str, required: bool) -> Self {
        Self {
            name: name.to_string(),
            description: description.to_string(),
            required,
            parameter_type: ParameterType::Boolean { default: None },
        }
    }

    /// Create an array parameter
    pub fn array(name: &str, description: &str, required: bool, item_type: ParameterType) -> Self {
        Self {
            name: name.to_string(),
            description: description.to_string(),
            required,
            parameter_type: ParameterType::Array {
                items: Box::new(item_type),
            },
        }
    }
}

/// Tool parameters extracted from request
#[derive(Debug, Clone)]
pub struct ToolParameters {
    params: HashMap<String, Value>,
}

impl ToolParameters {
    /// Create new tool parameters from a map
    pub fn new(params: HashMap<String, Value>) -> Self {
        Self { params }
    }

    /// Get a required string parameter
    pub fn get_string(&self, name: &str) -> Result<String, ToolError> {
        self.params
            .get(name)
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .ok_or_else(|| ToolError::MissingParameter(name.to_string()))
    }

    /// Get an optional string parameter
    pub fn get_optional_string(&self, name: &str) -> Option<String> {
        self.params
            .get(name)
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    }

    /// Get a required integer parameter
    pub fn get_integer(&self, name: &str) -> Result<i64, ToolError> {
        self.params
            .get(name)
            .and_then(|v| v.as_i64())
            .ok_or_else(|| ToolError::MissingParameter(name.to_string()))
    }

    /// Get an optional integer parameter
    pub fn get_optional_integer(&self, name: &str) -> Option<i64> {
        self.params.get(name).and_then(|v| v.as_i64())
    }

    /// Get a required boolean parameter
    pub fn get_boolean(&self, name: &str) -> Result<bool, ToolError> {
        self.params
            .get(name)
            .and_then(|v| v.as_bool())
            .ok_or_else(|| ToolError::MissingParameter(name.to_string()))
    }

    /// Get an optional boolean parameter
    pub fn get_optional_boolean(&self, name: &str) -> Option<bool> {
        self.params.get(name).and_then(|v| v.as_bool())
    }

    /// Get a required array parameter
    pub fn get_array(&self, name: &str) -> Result<Vec<Value>, ToolError> {
        self.params
            .get(name)
            .and_then(|v| v.as_array())
            .map(|arr| arr.clone())
            .ok_or_else(|| ToolError::MissingParameter(name.to_string()))
    }

    /// Get an optional array parameter
    pub fn get_optional_array(&self, name: &str) -> Option<Vec<Value>> {
        self.params
            .get(name)
            .and_then(|v| v.as_array())
            .map(|arr| arr.clone())
    }

    /// Get a string array parameter
    pub fn get_string_array(&self, name: &str) -> Result<Vec<String>, ToolError> {
        let array = self.get_array(name)?;
        array
            .into_iter()
            .map(|v| {
                v.as_str()
                    .map(|s| s.to_string())
                    .ok_or_else(|| ToolError::InvalidParameter {
                        parameter: name.to_string(),
                        reason: "Array contains non-string values".to_string(),
                    })
            })
            .collect()
    }

    /// Get an optional string array parameter
    pub fn get_optional_string_array(&self, name: &str) -> Option<Vec<String>> {
        self.get_optional_array(name).and_then(|array| {
            array
                .into_iter()
                .map(|v| v.as_str().map(|s| s.to_string()))
                .collect::<Option<Vec<_>>>()
        })
    }

    /// Get raw parameter value
    pub fn get_raw(&self, name: &str) -> Option<&Value> {
        self.params.get(name)
    }

    /// Check if parameter exists
    pub fn has_parameter(&self, name: &str) -> bool {
        self.params.contains_key(name)
    }
}

/// Tool execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResult {
    pub content: Vec<ToolContent>,
    #[serde(rename = "isError", skip_serializing_if = "Option::is_none")]
    pub is_error: Option<bool>,
}

impl ToolResult {
    /// Create a text result
    pub fn text(text: String) -> Self {
        Self {
            content: vec![ToolContent::Text { text }],
            is_error: None,
        }
    }

    /// Create an error result
    pub fn error(message: String) -> Self {
        Self {
            content: vec![ToolContent::Text { text: message }],
            is_error: Some(true),
        }
    }

    /// Create a JSON result
    pub fn json(data: Value) -> Self {
        Self {
            content: vec![ToolContent::Text {
                text: serde_json::to_string_pretty(&data).unwrap_or_else(|_| "{}".to_string()),
            }],
            is_error: None,
        }
    }

    /// Create a result with multiple content items
    pub fn multiple(content: Vec<ToolContent>) -> Self {
        Self {
            content,
            is_error: None,
        }
    }
}

/// Tool content types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ToolContent {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "image")]
    Image {
        data: String,
        #[serde(rename = "mimeType")]
        mime_type: String,
    },
    #[serde(rename = "resource")]
    Resource {
        resource: ResourceReference,
    },
}

/// Resource reference for tool content
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceReference {
    pub uri: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
}

/// Tool execution context
#[derive(Debug, Clone)]
pub struct ToolContext {
    pub request_id: String,
    pub user_agent: Option<String>,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

impl ToolContext {
    /// Create a new tool context
    pub fn new(request_id: String) -> Self {
        Self {
            request_id,
            user_agent: None,
            timestamp: chrono::Utc::now(),
        }
    }

    /// Set user agent
    pub fn with_user_agent(mut self, user_agent: String) -> Self {
        self.user_agent = Some(user_agent);
        self
    }
}

/// Tool execution error
#[derive(Debug, thiserror::Error)]
pub enum ToolError {
    #[error("Missing required parameter: {0}")]
    MissingParameter(String),

    #[error("Invalid parameter value: {parameter} - {reason}")]
    InvalidParameter { parameter: String, reason: String },

    #[error("Scope validation failed: {0}")]
    ScopeError(String),

    #[error("API call failed: {0}")]
    ApiError(String),

    #[error("Serialization failed: {0}")]
    SerializationError(#[from] serde_json::Error),

    #[error("HTTP client error: {0}")]
    HttpError(String),

    #[error("Internal error: {0}")]
    InternalError(String),
}

impl ToolError {
    /// Create an API error
    pub fn api<S: Into<String>>(message: S) -> Self {
        Self::ApiError(message.into())
    }

    /// Create an HTTP error
    pub fn http<S: Into<String>>(message: S) -> Self {
        Self::HttpError(message.into())
    }

    /// Create an internal error
    pub fn internal<S: Into<String>>(message: S) -> Self {
        Self::InternalError(message.into())
    }

    /// Create an invalid parameter error
    pub fn invalid_parameter<S: Into<String>>(parameter: S, reason: S) -> Self {
        Self::InvalidParameter {
            parameter: parameter.into(),
            reason: reason.into(),
        }
    }

    /// Create a scope error
    pub fn scope<S: Into<String>>(message: S) -> Self {
        Self::ScopeError(message.into())
    }
}

/// Tool trait for implementing MCP tools
#[async_trait]
pub trait Tool: Send + Sync {
    /// Get the tool name
    fn name(&self) -> &str;

    /// Get the tool description
    fn description(&self) -> &str;

    /// Get the tool parameters
    fn parameters(&self) -> Vec<ToolParameter>;

    /// Get the scope requirement for this tool
    fn scope_requirement(&self) -> ScopeRequirement;

    /// Check if this tool requires write access
    fn requires_write_access(&self) -> bool {
        false
    }

    /// Execute the tool
    async fn execute(
        &self,
        context: &ToolContext,
        parameters: &ToolParameters,
        scope: &Scope,
    ) -> Result<ToolResult, ToolError>;

    /// Validate parameters before execution
    fn validate_parameters(&self, parameters: &ToolParameters) -> Result<(), ToolError> {
        for param in self.parameters() {
            if param.required && !parameters.has_parameter(&param.name) {
                return Err(ToolError::MissingParameter(param.name));
            }
        }
        Ok(())
    }

    /// Validate scope for this tool
    fn validate_scope(&self, scope: &Scope) -> Result<(), ToolError> {
        if !scope.satisfies(&self.scope_requirement()) {
            return Err(ToolError::scope(format!(
                "Tool '{}' requires {:?} scope",
                self.name(),
                self.scope_requirement()
            )));
        }
        Ok(())
    }
}

/// Tool registry for managing available tools
#[derive(Debug, Default)]
pub struct ToolRegistry {
    tools: HashMap<String, Box<dyn Tool>>,
}

impl ToolRegistry {
    /// Create a new tool registry
    pub fn new() -> Self {
        Self {
            tools: HashMap::new(),
        }
    }

    /// Register a tool
    pub fn register(&mut self, tool: Box<dyn Tool>) {
        let name = tool.name().to_string();
        self.tools.insert(name, tool);
    }

    /// Get a tool by name
    pub fn get(&self, name: &str) -> Option<&dyn Tool> {
        self.tools.get(name).map(|t| t.as_ref())
    }

    /// List all tool names
    pub fn list_tools(&self) -> Vec<String> {
        self.tools.keys().cloned().collect()
    }

    /// Get all tools
    pub fn get_all_tools(&self) -> Vec<&dyn Tool> {
        self.tools.values().map(|t| t.as_ref()).collect()
    }

    /// Filter tools by scope requirement
    pub fn filter_by_scope(&self, scope: &Scope) -> Vec<&dyn Tool> {
        self.tools
            .values()
            .filter(|tool| scope.satisfies(&tool.scope_requirement()))
            .map(|t| t.as_ref())
            .collect()
    }

    /// Filter tools by write access requirement
    pub fn filter_read_only(&self) -> Vec<&dyn Tool> {
        self.tools
            .values()
            .filter(|tool| !tool.requires_write_access())
            .map(|t| t.as_ref())
            .collect()
    }
}

/// Tool execution service
pub struct ToolExecutor {
    registry: ToolRegistry,
    read_only: bool,
}

impl ToolExecutor {
    /// Create a new tool executor
    pub fn new(registry: ToolRegistry, read_only: bool) -> Self {
        Self { registry, read_only }
    }

    /// Execute a tool by name
    pub async fn execute_tool(
        &self,
        tool_name: &str,
        context: &ToolContext,
        parameters: &ToolParameters,
        scope: &Scope,
    ) -> Result<ToolResult, ToolError> {
        let tool = self
            .registry
            .get(tool_name)
            .ok_or_else(|| ToolError::internal(format!("Tool '{}' not found", tool_name)))?;

        // Check read-only mode
        if self.read_only && tool.requires_write_access() {
            return Err(ToolError::internal(format!(
                "Tool '{}' requires write access but server is in read-only mode",
                tool_name
            )));
        }

        // Validate scope
        tool.validate_scope(scope)?;

        // Validate parameters
        tool.validate_parameters(parameters)?;

        // Execute tool
        tool.execute(context, parameters, scope).await
    }

    /// List available tools for the given scope
    pub fn list_available_tools(&self, scope: &Scope) -> Vec<&dyn Tool> {
        let mut tools = self.registry.filter_by_scope(scope);

        // Filter out write tools if in read-only mode
        if self.read_only {
            tools = tools
                .into_iter()
                .filter(|tool| !tool.requires_write_access())
                .collect();
        }

        tools
    }

    /// Get tool registry
    pub fn registry(&self) -> &ToolRegistry {
        &self.registry
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tool_parameters() {
        let mut params = HashMap::new();
        params.insert("name".to_string(), Value::String("test".to_string()));
        params.insert("count".to_string(), Value::Number(42.into()));
        params.insert("enabled".to_string(), Value::Bool(true));

        let tool_params = ToolParameters::new(params);

        assert_eq!(tool_params.get_string("name").unwrap(), "test");
        assert_eq!(tool_params.get_integer("count").unwrap(), 42);
        assert_eq!(tool_params.get_boolean("enabled").unwrap(), true);
        assert!(tool_params.get_string("missing").is_err());
    }

    #[test]
    fn test_tool_result() {
        let result = ToolResult::text("Hello, world!".to_string());
        assert_eq!(result.content.len(), 1);
        assert!(matches!(result.content[0], ToolContent::Text { .. }));
        assert!(result.is_error.is_none());

        let error_result = ToolResult::error("Something went wrong".to_string());
        assert_eq!(error_result.is_error, Some(true));
    }

    #[test]
    fn test_parameter_types() {
        let string_param = ToolParameter::string("name", "A name parameter", true);
        assert_eq!(string_param.name, "name");
        assert!(string_param.required);

        let enum_param = ToolParameter::string_enum(
            "status",
            "Status value",
            false,
            vec!["active".to_string(), "inactive".to_string()],
        );
        assert!(!enum_param.required);
        if let ParameterType::String { enum_values, .. } = &enum_param.parameter_type {
            assert!(enum_values.is_some());
        }
    }
}