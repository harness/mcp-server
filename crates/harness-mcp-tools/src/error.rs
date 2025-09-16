use crate::mcp::ToolResult;
use thiserror::Error;

/// Result type for tool operations
pub type Result<T> = std::result::Result<T, ToolError>;

/// Tool error types
#[derive(Error, Debug)]
pub enum ToolError {
    #[error("Invalid parameters: {0}")]
    InvalidParameters(String),

    #[error("Missing required parameter: {0}")]
    MissingParameter(String),

    #[error("Invalid parameter value for '{param}': {message}")]
    InvalidParameterValue { param: String, message: String },

    #[error("Tool not found: {0}")]
    ToolNotFound(String),

    #[error("Tool execution failed: {0}")]
    ExecutionFailed(String),

    #[error("Authentication required")]
    AuthenticationRequired,

    #[error("Insufficient permissions: {0}")]
    InsufficientPermissions(String),

    #[error("Resource not found: {0}")]
    ResourceNotFound(String),

    #[error("Service unavailable: {0}")]
    ServiceUnavailable(String),

    #[error("Rate limit exceeded: {0}")]
    RateLimit(String),

    #[error("Timeout: {0}")]
    Timeout(String),

    #[error("Configuration error: {0}")]
    Configuration(String),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("HTTP client error: {0}")]
    HttpClient(#[from] anyhow::Error),

    #[error("Unknown error: {0}")]
    Unknown(String),
}

impl ToolError {
    /// Create a new invalid parameters error
    pub fn invalid_parameters<S: Into<String>>(msg: S) -> Self {
        Self::InvalidParameters(msg.into())
    }

    /// Create a new missing parameter error
    pub fn missing_parameter<S: Into<String>>(param: S) -> Self {
        Self::MissingParameter(param.into())
    }

    /// Create a new invalid parameter value error
    pub fn invalid_parameter_value<S: Into<String>>(param: S, message: S) -> Self {
        Self::InvalidParameterValue {
            param: param.into(),
            message: message.into(),
        }
    }

    /// Create a new tool not found error
    pub fn tool_not_found<S: Into<String>>(tool: S) -> Self {
        Self::ToolNotFound(tool.into())
    }

    /// Create a new execution failed error
    pub fn execution_failed<S: Into<String>>(msg: S) -> Self {
        Self::ExecutionFailed(msg.into())
    }

    /// Create a new insufficient permissions error
    pub fn insufficient_permissions<S: Into<String>>(msg: S) -> Self {
        Self::InsufficientPermissions(msg.into())
    }

    /// Create a new resource not found error
    pub fn resource_not_found<S: Into<String>>(resource: S) -> Self {
        Self::ResourceNotFound(resource.into())
    }

    /// Create a new service unavailable error
    pub fn service_unavailable<S: Into<String>>(msg: S) -> Self {
        Self::ServiceUnavailable(msg.into())
    }

    /// Create a new rate limit error
    pub fn rate_limit<S: Into<String>>(msg: S) -> Self {
        Self::RateLimit(msg.into())
    }

    /// Create a new timeout error
    pub fn timeout<S: Into<String>>(msg: S) -> Self {
        Self::Timeout(msg.into())
    }

    /// Create a new configuration error
    pub fn configuration<S: Into<String>>(msg: S) -> Self {
        Self::Configuration(msg.into())
    }

    /// Create a new unknown error
    pub fn unknown<S: Into<String>>(msg: S) -> Self {
        Self::Unknown(msg.into())
    }

    /// Convert this error to a tool result
    pub fn to_tool_result(self) -> ToolResult {
        ToolResult::error(self.to_string())
    }

    /// Check if this error is retryable
    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            Self::ServiceUnavailable(_) | Self::RateLimit(_) | Self::Timeout(_)
        )
    }

    /// Check if this error is a client error (user's fault)
    pub fn is_client_error(&self) -> bool {
        matches!(
            self,
            Self::InvalidParameters(_)
                | Self::MissingParameter(_)
                | Self::InvalidParameterValue { .. }
                | Self::ToolNotFound(_)
                | Self::AuthenticationRequired
                | Self::InsufficientPermissions(_)
                | Self::ResourceNotFound(_)
        )
    }

    /// Check if this error is a server error (system's fault)
    pub fn is_server_error(&self) -> bool {
        matches!(
            self,
            Self::ExecutionFailed(_)
                | Self::ServiceUnavailable(_)
                | Self::Configuration(_)
                | Self::Unknown(_)
        )
    }
}

/// Parameter validation utilities
pub struct ParameterValidator;

impl ParameterValidator {
    /// Validate that a required parameter is present
    pub fn require_parameter(
        params: &std::collections::HashMap<String, serde_json::Value>,
        name: &str,
    ) -> Result<&serde_json::Value> {
        params
            .get(name)
            .ok_or_else(|| ToolError::missing_parameter(name))
    }

    /// Validate and extract a string parameter
    pub fn require_string(
        params: &std::collections::HashMap<String, serde_json::Value>,
        name: &str,
    ) -> Result<String> {
        let value = Self::require_parameter(params, name)?;
        value
            .as_str()
            .map(|s| s.to_string())
            .ok_or_else(|| {
                ToolError::invalid_parameter_value(name, "Expected string value")
            })
    }

    /// Validate and extract an optional string parameter
    pub fn optional_string(
        params: &std::collections::HashMap<String, serde_json::Value>,
        name: &str,
    ) -> Result<Option<String>> {
        match params.get(name) {
            Some(value) => {
                if value.is_null() {
                    Ok(None)
                } else {
                    value
                        .as_str()
                        .map(|s| Some(s.to_string()))
                        .ok_or_else(|| {
                            ToolError::invalid_parameter_value(name, "Expected string value")
                        })
                }
            }
            None => Ok(None),
        }
    }

    /// Validate and extract an integer parameter
    pub fn require_integer(
        params: &std::collections::HashMap<String, serde_json::Value>,
        name: &str,
    ) -> Result<i64> {
        let value = Self::require_parameter(params, name)?;
        value
            .as_i64()
            .ok_or_else(|| {
                ToolError::invalid_parameter_value(name, "Expected integer value")
            })
    }

    /// Validate and extract an optional integer parameter
    pub fn optional_integer(
        params: &std::collections::HashMap<String, serde_json::Value>,
        name: &str,
    ) -> Result<Option<i64>> {
        match params.get(name) {
            Some(value) => {
                if value.is_null() {
                    Ok(None)
                } else {
                    value
                        .as_i64()
                        .map(Some)
                        .ok_or_else(|| {
                            ToolError::invalid_parameter_value(name, "Expected integer value")
                        })
                }
            }
            None => Ok(None),
        }
    }

    /// Validate and extract a boolean parameter
    pub fn require_boolean(
        params: &std::collections::HashMap<String, serde_json::Value>,
        name: &str,
    ) -> Result<bool> {
        let value = Self::require_parameter(params, name)?;
        value
            .as_bool()
            .ok_or_else(|| {
                ToolError::invalid_parameter_value(name, "Expected boolean value")
            })
    }

    /// Validate and extract an optional boolean parameter
    pub fn optional_boolean(
        params: &std::collections::HashMap<String, serde_json::Value>,
        name: &str,
    ) -> Result<Option<bool>> {
        match params.get(name) {
            Some(value) => {
                if value.is_null() {
                    Ok(None)
                } else {
                    value
                        .as_bool()
                        .map(Some)
                        .ok_or_else(|| {
                            ToolError::invalid_parameter_value(name, "Expected boolean value")
                        })
                }
            }
            None => Ok(None),
        }
    }

    /// Validate and extract an array parameter
    pub fn require_array(
        params: &std::collections::HashMap<String, serde_json::Value>,
        name: &str,
    ) -> Result<&Vec<serde_json::Value>> {
        let value = Self::require_parameter(params, name)?;
        value
            .as_array()
            .ok_or_else(|| {
                ToolError::invalid_parameter_value(name, "Expected array value")
            })
    }

    /// Validate that a string parameter matches one of the allowed values
    pub fn validate_enum(
        params: &std::collections::HashMap<String, serde_json::Value>,
        name: &str,
        allowed_values: &[&str],
    ) -> Result<String> {
        let value = Self::require_string(params, name)?;
        if allowed_values.contains(&value.as_str()) {
            Ok(value)
        } else {
            Err(ToolError::invalid_parameter_value(
                name,
                format!("Must be one of: {}", allowed_values.join(", ")),
            ))
        }
    }

    /// Validate that an integer parameter is within a range
    pub fn validate_range(
        params: &std::collections::HashMap<String, serde_json::Value>,
        name: &str,
        min: i64,
        max: i64,
    ) -> Result<i64> {
        let value = Self::require_integer(params, name)?;
        if value >= min && value <= max {
            Ok(value)
        } else {
            Err(ToolError::invalid_parameter_value(
                name,
                format!("Must be between {} and {}", min, max),
            ))
        }
    }
}

/// Error handling utilities for tools
pub struct ErrorHandler;

impl ErrorHandler {
    /// Handle and convert various error types to ToolError
    pub fn handle_client_error(error: anyhow::Error) -> ToolError {
        let error_str = error.to_string().to_lowercase();
        
        if error_str.contains("unauthorized") || error_str.contains("401") {
            ToolError::AuthenticationRequired
        } else if error_str.contains("forbidden") || error_str.contains("403") {
            ToolError::InsufficientPermissions(error.to_string())
        } else if error_str.contains("not found") || error_str.contains("404") {
            ToolError::ResourceNotFound(error.to_string())
        } else if error_str.contains("rate limit") || error_str.contains("429") {
            ToolError::RateLimit(error.to_string())
        } else if error_str.contains("service unavailable") || error_str.contains("503") {
            ToolError::ServiceUnavailable(error.to_string())
        } else if error_str.contains("timeout") {
            ToolError::Timeout(error.to_string())
        } else {
            ToolError::HttpClient(error)
        }
    }

    /// Create a user-friendly error message
    pub fn user_friendly_message(error: &ToolError) -> String {
        match error {
            ToolError::InvalidParameters(msg) => format!("Invalid parameters: {}", msg),
            ToolError::MissingParameter(param) => format!("Missing required parameter: {}", param),
            ToolError::InvalidParameterValue { param, message } => {
                format!("Invalid value for parameter '{}': {}", param, message)
            }
            ToolError::ToolNotFound(tool) => format!("Tool '{}' not found", tool),
            ToolError::ExecutionFailed(msg) => format!("Tool execution failed: {}", msg),
            ToolError::AuthenticationRequired => "Authentication is required to use this tool".to_string(),
            ToolError::InsufficientPermissions(msg) => format!("Insufficient permissions: {}", msg),
            ToolError::ResourceNotFound(resource) => format!("Resource not found: {}", resource),
            ToolError::ServiceUnavailable(_) => "Service is temporarily unavailable. Please try again later.".to_string(),
            ToolError::RateLimit(_) => "Rate limit exceeded. Please wait before making more requests.".to_string(),
            ToolError::Timeout(_) => "Request timed out. Please try again.".to_string(),
            ToolError::Configuration(msg) => format!("Configuration error: {}", msg),
            ToolError::Serialization(_) => "Data serialization error".to_string(),
            ToolError::HttpClient(_) => "Network communication error".to_string(),
            ToolError::Unknown(msg) => format!("An unexpected error occurred: {}", msg),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn test_tool_error_creation() {
        let err = ToolError::missing_parameter("account_id");
        assert!(err.is_client_error());
        assert!(!err.is_server_error());
        assert!(!err.is_retryable());
    }

    #[test]
    fn test_parameter_validation() {
        let mut params = HashMap::new();
        params.insert("name".to_string(), serde_json::Value::String("test".to_string()));
        params.insert("count".to_string(), serde_json::Value::Number(serde_json::Number::from(42)));
        params.insert("enabled".to_string(), serde_json::Value::Bool(true));

        // Test string validation
        let name = ParameterValidator::require_string(&params, "name").unwrap();
        assert_eq!(name, "test");

        // Test integer validation
        let count = ParameterValidator::require_integer(&params, "count").unwrap();
        assert_eq!(count, 42);

        // Test boolean validation
        let enabled = ParameterValidator::require_boolean(&params, "enabled").unwrap();
        assert!(enabled);

        // Test missing parameter
        let result = ParameterValidator::require_string(&params, "missing");
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), ToolError::MissingParameter(_)));
    }

    #[test]
    fn test_optional_parameters() {
        let mut params = HashMap::new();
        params.insert("name".to_string(), serde_json::Value::String("test".to_string()));
        params.insert("null_value".to_string(), serde_json::Value::Null);

        // Test optional parameter that exists
        let name = ParameterValidator::optional_string(&params, "name").unwrap();
        assert_eq!(name, Some("test".to_string()));

        // Test optional parameter that doesn't exist
        let missing = ParameterValidator::optional_string(&params, "missing").unwrap();
        assert_eq!(missing, None);

        // Test optional parameter that is null
        let null_value = ParameterValidator::optional_string(&params, "null_value").unwrap();
        assert_eq!(null_value, None);
    }

    #[test]
    fn test_enum_validation() {
        let mut params = HashMap::new();
        params.insert("status".to_string(), serde_json::Value::String("active".to_string()));

        let allowed = &["active", "inactive", "pending"];
        let status = ParameterValidator::validate_enum(&params, "status", allowed).unwrap();
        assert_eq!(status, "active");

        params.insert("status".to_string(), serde_json::Value::String("invalid".to_string()));
        let result = ParameterValidator::validate_enum(&params, "status", allowed);
        assert!(result.is_err());
    }

    #[test]
    fn test_range_validation() {
        let mut params = HashMap::new();
        params.insert("page".to_string(), serde_json::Value::Number(serde_json::Number::from(5)));

        let page = ParameterValidator::validate_range(&params, "page", 1, 100).unwrap();
        assert_eq!(page, 5);

        params.insert("page".to_string(), serde_json::Value::Number(serde_json::Number::from(150)));
        let result = ParameterValidator::validate_range(&params, "page", 1, 100);
        assert!(result.is_err());
    }

    #[test]
    fn test_error_to_tool_result() {
        let error = ToolError::missing_parameter("account_id");
        let result = error.to_tool_result();
        assert_eq!(result.is_error, Some(true));
        assert_eq!(result.content.len(), 1);
    }

    #[test]
    fn test_user_friendly_messages() {
        let error = ToolError::missing_parameter("account_id");
        let message = ErrorHandler::user_friendly_message(&error);
        assert!(message.contains("Missing required parameter"));
        assert!(message.contains("account_id"));
    }
}