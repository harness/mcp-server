use thiserror::Error;
use serde::{Deserialize, Serialize};

/// Main error type for the Harness MCP server
#[derive(Error, Debug)]
pub enum HarnessError {
    #[error("API error: {message}")]
    Api {
        message: String,
        code: Option<String>,
        correlation_id: Option<String>,
    },

    #[error("Authentication error: {0}")]
    Authentication(String),

    #[error("Authorization error: {0}")]
    Authorization(String),

    #[error("Configuration error: {0}")]
    Configuration(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("UUID error: {0}")]
    Uuid(#[from] uuid::Error),

    #[error("Time parsing error: {0}")]
    Time(#[from] chrono::ParseError),

    #[error("JWT error: {0}")]
    Jwt(#[from] jsonwebtoken::errors::Error),

    #[error("MCP protocol error: {0}")]
    Mcp(String),

    #[error("Tool execution error: {0}")]
    ToolExecution(String),

    #[error("Resource not found: {0}")]
    NotFound(String),

    #[error("Rate limit exceeded")]
    RateLimit,

    #[error("Service unavailable")]
    ServiceUnavailable,

    #[error("Internal server error: {0}")]
    Internal(String),
}

/// Result type alias for convenience
pub type Result<T> = std::result::Result<T, HarnessError>;

/// Error response that can be serialized for API responses
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub error: String,
    pub message: String,
    pub code: Option<String>,
    pub correlation_id: Option<String>,
    pub details: Option<serde_json::Value>,
}

impl From<HarnessError> for ErrorResponse {
    fn from(error: HarnessError) -> Self {
        match error {
            HarnessError::Api { message, code, correlation_id } => ErrorResponse {
                error: "API_ERROR".to_string(),
                message,
                code,
                correlation_id,
                details: None,
            },
            HarnessError::Authentication(msg) => ErrorResponse {
                error: "AUTHENTICATION_ERROR".to_string(),
                message: msg,
                code: Some("AUTH_001".to_string()),
                correlation_id: None,
                details: None,
            },
            HarnessError::Authorization(msg) => ErrorResponse {
                error: "AUTHORIZATION_ERROR".to_string(),
                message: msg,
                code: Some("AUTH_002".to_string()),
                correlation_id: None,
                details: None,
            },
            HarnessError::Configuration(msg) => ErrorResponse {
                error: "CONFIGURATION_ERROR".to_string(),
                message: msg,
                code: Some("CONFIG_001".to_string()),
                correlation_id: None,
                details: None,
            },
            HarnessError::Validation(msg) => ErrorResponse {
                error: "VALIDATION_ERROR".to_string(),
                message: msg,
                code: Some("VALID_001".to_string()),
                correlation_id: None,
                details: None,
            },
            HarnessError::Network(err) => ErrorResponse {
                error: "NETWORK_ERROR".to_string(),
                message: err.to_string(),
                code: Some("NET_001".to_string()),
                correlation_id: None,
                details: None,
            },
            HarnessError::NotFound(resource) => ErrorResponse {
                error: "NOT_FOUND".to_string(),
                message: format!("Resource not found: {}", resource),
                code: Some("NOT_FOUND_001".to_string()),
                correlation_id: None,
                details: None,
            },
            HarnessError::RateLimit => ErrorResponse {
                error: "RATE_LIMIT".to_string(),
                message: "Rate limit exceeded".to_string(),
                code: Some("RATE_001".to_string()),
                correlation_id: None,
                details: None,
            },
            HarnessError::ServiceUnavailable => ErrorResponse {
                error: "SERVICE_UNAVAILABLE".to_string(),
                message: "Service temporarily unavailable".to_string(),
                code: Some("SVC_001".to_string()),
                correlation_id: None,
                details: None,
            },
            _ => ErrorResponse {
                error: "INTERNAL_ERROR".to_string(),
                message: error.to_string(),
                code: Some("INT_001".to_string()),
                correlation_id: None,
                details: None,
            },
        }
    }
}

/// Tool-specific error for MCP tool execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolError {
    pub tool_name: String,
    pub error_type: String,
    pub message: String,
    pub details: Option<serde_json::Value>,
}

impl ToolError {
    pub fn new(tool_name: &str, error_type: &str, message: &str) -> Self {
        Self {
            tool_name: tool_name.to_string(),
            error_type: error_type.to_string(),
            message: message.to_string(),
            details: None,
        }
    }

    pub fn with_details(mut self, details: serde_json::Value) -> Self {
        self.details = Some(details);
        self
    }
}

/// Validation error for tool parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationError {
    pub parameter: String,
    pub expected: String,
    pub actual: Option<String>,
    pub message: String,
}

impl ValidationError {
    pub fn required_parameter(parameter: &str) -> Self {
        Self {
            parameter: parameter.to_string(),
            expected: "required parameter".to_string(),
            actual: None,
            message: format!("Parameter '{}' is required but was not provided", parameter),
        }
    }

    pub fn invalid_type(parameter: &str, expected: &str, actual: &str) -> Self {
        Self {
            parameter: parameter.to_string(),
            expected: expected.to_string(),
            actual: Some(actual.to_string()),
            message: format!(
                "Parameter '{}' expected type '{}' but got '{}'",
                parameter, expected, actual
            ),
        }
    }

    pub fn invalid_value(parameter: &str, value: &str, reason: &str) -> Self {
        Self {
            parameter: parameter.to_string(),
            expected: "valid value".to_string(),
            actual: Some(value.to_string()),
            message: format!(
                "Parameter '{}' has invalid value '{}': {}",
                parameter, value, reason
            ),
        }
    }
}

/// HTTP status code mapping for errors
impl HarnessError {
    pub fn status_code(&self) -> u16 {
        match self {
            HarnessError::Authentication(_) => 401,
            HarnessError::Authorization(_) => 403,
            HarnessError::NotFound(_) => 404,
            HarnessError::Validation(_) => 400,
            HarnessError::Configuration(_) => 400,
            HarnessError::RateLimit => 429,
            HarnessError::ServiceUnavailable => 503,
            HarnessError::Network(_) => 502,
            _ => 500,
        }
    }
}

/// Helper function to create API errors from HTTP responses
pub fn api_error_from_response(
    status: u16,
    body: &str,
    correlation_id: Option<String>,
) -> HarnessError {
    let message = if body.is_empty() {
        format!("HTTP {} error", status)
    } else {
        // Try to parse as JSON error response
        if let Ok(error_response) = serde_json::from_str::<ErrorResponse>(body) {
            error_response.message
        } else {
            body.to_string()
        }
    };

    let code = Some(format!("HTTP_{}", status));

    match status {
        401 => HarnessError::Authentication(message),
        403 => HarnessError::Authorization(message),
        404 => HarnessError::NotFound(message),
        400 => HarnessError::Validation(message),
        429 => HarnessError::RateLimit,
        503 => HarnessError::ServiceUnavailable,
        _ => HarnessError::Api {
            message,
            code,
            correlation_id,
        },
    }
}