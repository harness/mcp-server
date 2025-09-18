use thiserror::Error;

/// Main error type for the Harness MCP Server
#[derive(Error, Debug)]
pub enum HarnessError {
    /// Configuration errors
    #[error("Configuration error: {0}")]
    Config(String),

    /// Authentication errors
    #[error("Authentication error: {0}")]
    Auth(String),

    /// API errors with optional status code
    #[error("API error: {message}")]
    Api { 
        message: String,
        status_code: Option<u16>,
        error_code: Option<String>,
    },

    /// HTTP client errors
    #[error("HTTP error: {message}")]
    Http { message: String },

    /// JSON serialization/deserialization errors
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    /// JWT token errors
    #[error("JWT error: {0}")]
    Jwt(#[from] jsonwebtoken::errors::Error),

    /// HTTP request errors
    #[error("Request error: {0}")]
    Request(#[from] reqwest::Error),

    /// IO errors
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    /// Validation errors with field context
    #[error("Validation error: {message}")]
    Validation { 
        message: String,
        field: Option<String>,
    },

    /// Tool execution errors with tool context
    #[error("Tool error in '{tool}': {message}")]
    Tool { 
        tool: String,
        message: String,
        cause: Option<Box<HarnessError>>,
    },

    /// Server errors
    #[error("Server error: {0}")]
    Server(String),

    /// MCP protocol errors
    #[error("MCP protocol error: {message}")]
    Mcp { 
        message: String,
        code: Option<i32>,
    },

    /// Resource not found errors
    #[error("Resource not found: {resource_type} with ID '{id}'")]
    NotFound { 
        resource_type: String,
        id: String,
    },

    /// Permission denied errors
    #[error("Permission denied: {action} on {resource}")]
    PermissionDenied { 
        action: String,
        resource: String,
    },

    /// Rate limiting errors
    #[error("Rate limit exceeded: {message}")]
    RateLimit { 
        message: String,
        retry_after: Option<u64>,
    },

    /// Timeout errors
    #[error("Operation timed out: {operation}")]
    Timeout { operation: String },

    /// Generic errors
    #[error("Error: {0}")]
    Generic(String),
}

impl HarnessError {
    /// Create a new configuration error
    pub fn config(msg: impl Into<String>) -> Self {
        Self::Config(msg.into())
    }

    /// Create a new authentication error
    pub fn auth(msg: impl Into<String>) -> Self {
        Self::Auth(msg.into())
    }

    /// Create a new API error
    pub fn api(msg: impl Into<String>) -> Self {
        Self::Api {
            message: msg.into(),
            status_code: None,
            error_code: None,
        }
    }

    /// Create a new API error with status code
    pub fn api_with_status(msg: impl Into<String>, status_code: u16) -> Self {
        Self::Api {
            message: msg.into(),
            status_code: Some(status_code),
            error_code: None,
        }
    }

    /// Create a new API error with status code and error code
    pub fn api_with_codes(msg: impl Into<String>, status_code: u16, error_code: impl Into<String>) -> Self {
        Self::Api {
            message: msg.into(),
            status_code: Some(status_code),
            error_code: Some(error_code.into()),
        }
    }

    /// Create a new HTTP error
    pub fn http(msg: impl Into<String>) -> Self {
        Self::Http {
            message: msg.into(),
        }
    }

    /// Create a new validation error
    pub fn validation(msg: impl Into<String>) -> Self {
        Self::Validation {
            message: msg.into(),
            field: None,
        }
    }

    /// Create a new validation error with field context
    pub fn validation_field(msg: impl Into<String>, field: impl Into<String>) -> Self {
        Self::Validation {
            message: msg.into(),
            field: Some(field.into()),
        }
    }

    /// Create a new tool error
    pub fn tool(tool: impl Into<String>, msg: impl Into<String>) -> Self {
        Self::Tool {
            tool: tool.into(),
            message: msg.into(),
            cause: None,
        }
    }

    /// Create a new tool error with cause
    pub fn tool_with_cause(tool: impl Into<String>, msg: impl Into<String>, cause: HarnessError) -> Self {
        Self::Tool {
            tool: tool.into(),
            message: msg.into(),
            cause: Some(Box::new(cause)),
        }
    }

    /// Create a new server error
    pub fn server(msg: impl Into<String>) -> Self {
        Self::Server(msg.into())
    }

    /// Create a new MCP protocol error
    pub fn mcp(msg: impl Into<String>) -> Self {
        Self::Mcp {
            message: msg.into(),
            code: None,
        }
    }

    /// Create a new MCP protocol error with code
    pub fn mcp_with_code(msg: impl Into<String>, code: i32) -> Self {
        Self::Mcp {
            message: msg.into(),
            code: Some(code),
        }
    }

    /// Create a new not found error
    pub fn not_found(resource_type: impl Into<String>, id: impl Into<String>) -> Self {
        Self::NotFound {
            resource_type: resource_type.into(),
            id: id.into(),
        }
    }

    /// Create a new permission denied error
    pub fn permission_denied(action: impl Into<String>, resource: impl Into<String>) -> Self {
        Self::PermissionDenied {
            action: action.into(),
            resource: resource.into(),
        }
    }

    /// Create a new rate limit error
    pub fn rate_limit(msg: impl Into<String>) -> Self {
        Self::RateLimit {
            message: msg.into(),
            retry_after: None,
        }
    }

    /// Create a new rate limit error with retry after
    pub fn rate_limit_with_retry(msg: impl Into<String>, retry_after: u64) -> Self {
        Self::RateLimit {
            message: msg.into(),
            retry_after: Some(retry_after),
        }
    }

    /// Create a new timeout error
    pub fn timeout(operation: impl Into<String>) -> Self {
        Self::Timeout {
            operation: operation.into(),
        }
    }

    /// Create a new generic error
    pub fn generic(msg: impl Into<String>) -> Self {
        Self::Generic(msg.into())
    }

    /// Check if this error is retryable
    pub fn is_retryable(&self) -> bool {
        match self {
            HarnessError::Request(_) => true,
            HarnessError::Http { .. } => true,
            HarnessError::Api { status_code: Some(code), .. } => {
                // Retry on 5xx server errors and some 4xx errors
                *code >= 500 || *code == 429 || *code == 408
            }
            HarnessError::RateLimit { .. } => true,
            HarnessError::Timeout { .. } => true,
            HarnessError::Server(_) => true,
            _ => false,
        }
    }

    /// Get the HTTP status code if available
    pub fn status_code(&self) -> Option<u16> {
        match self {
            HarnessError::Api { status_code, .. } => *status_code,
            HarnessError::NotFound { .. } => Some(404),
            HarnessError::PermissionDenied { .. } => Some(403),
            HarnessError::RateLimit { .. } => Some(429),
            HarnessError::Validation { .. } => Some(400),
            _ => None,
        }
    }

    /// Get the error code if available
    pub fn error_code(&self) -> Option<&str> {
        match self {
            HarnessError::Api { error_code, .. } => error_code.as_deref(),
            HarnessError::Mcp { code, .. } => code.as_ref().map(|c| match *c {
                -32700 => "PARSE_ERROR",
                -32600 => "INVALID_REQUEST",
                -32601 => "METHOD_NOT_FOUND",
                -32602 => "INVALID_PARAMS",
                -32603 => "INTERNAL_ERROR",
                _ => "UNKNOWN_ERROR",
            }),
            _ => None,
        }
    }
}

/// Result type alias for convenience
pub type Result<T> = std::result::Result<T, HarnessError>;

/// Convert anyhow::Error to HarnessError
impl From<anyhow::Error> for HarnessError {
    fn from(err: anyhow::Error) -> Self {
        Self::Generic(err.to_string())
    }
}

/// Convert URL parse errors to HarnessError
impl From<url::ParseError> for HarnessError {
    fn from(err: url::ParseError) -> Self {
        Self::validation(format!("Invalid URL: {}", err))
    }
}

/// Error context extension trait for adding context to errors
pub trait ErrorContext<T> {
    /// Add context to an error
    fn with_context<F>(self, f: F) -> Result<T>
    where
        F: FnOnce() -> String;

    /// Add context to an error with a static string
    fn context(self, msg: &'static str) -> Result<T>;
}

impl<T, E> ErrorContext<T> for std::result::Result<T, E>
where
    E: Into<HarnessError>,
{
    fn with_context<F>(self, f: F) -> Result<T>
    where
        F: FnOnce() -> String,
    {
        self.map_err(|e| {
            let original_error = e.into();
            HarnessError::generic(format!("{}: {}", f(), original_error))
        })
    }

    fn context(self, msg: &'static str) -> Result<T> {
        self.with_context(|| msg.to_string())
    }
}

/// Helper macro for creating validation errors with field context
#[macro_export]
macro_rules! validation_error {
    ($msg:expr) => {
        $crate::error::HarnessError::validation($msg)
    };
    ($field:expr, $msg:expr) => {
        $crate::error::HarnessError::validation_field($msg, $field)
    };
}

/// Helper macro for creating tool errors
#[macro_export]
macro_rules! tool_error {
    ($tool:expr, $msg:expr) => {
        $crate::error::HarnessError::tool($tool, $msg)
    };
    ($tool:expr, $msg:expr, $cause:expr) => {
        $crate::error::HarnessError::tool_with_cause($tool, $msg, $cause)
    };
}

/// Helper macro for early return with context
#[macro_export]
macro_rules! ensure {
    ($cond:expr, $err:expr) => {
        if !($cond) {
            return Err($err.into());
        }
    };
}

/// Helper macro for early return with validation error
#[macro_export]
macro_rules! ensure_valid {
    ($cond:expr, $msg:expr) => {
        if !($cond) {
            return Err($crate::error::HarnessError::validation($msg));
        }
    };
    ($cond:expr, $field:expr, $msg:expr) => {
        if !($cond) {
            return Err($crate::error::HarnessError::validation_field($msg, $field));
        }
    };
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_creation() {
        let err = HarnessError::validation("test message");
        assert!(matches!(err, HarnessError::Validation { .. }));
        assert_eq!(err.to_string(), "Validation error: test message");
    }

    #[test]
    fn test_error_with_field() {
        let err = HarnessError::validation_field("invalid value", "username");
        assert!(matches!(err, HarnessError::Validation { .. }));
        assert_eq!(err.to_string(), "Validation error: invalid value");
    }

    #[test]
    fn test_api_error_with_status() {
        let err = HarnessError::api_with_status("not found", 404);
        assert_eq!(err.status_code(), Some(404));
    }

    #[test]
    fn test_retryable_errors() {
        assert!(HarnessError::rate_limit("too many requests").is_retryable());
        assert!(HarnessError::timeout("request timeout").is_retryable());
        assert!(!HarnessError::validation("bad input").is_retryable());
    }

    #[test]
    fn test_error_context() {
        let result: std::result::Result<(), std::io::Error> = Err(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "file not found",
        ));
        
        let err = result.context("failed to read config file").unwrap_err();
        assert!(err.to_string().contains("failed to read config file"));
    }

    #[test]
    fn test_validation_error_macro() {
        let err = validation_error!("test message");
        assert!(matches!(err, HarnessError::Validation { .. }));
        
        let err = validation_error!("field_name", "invalid field");
        assert!(matches!(err, HarnessError::Validation { .. }));
    }

    #[test]
    fn test_tool_error_macro() {
        let err = tool_error!("test_tool", "tool failed");
        assert!(matches!(err, HarnessError::Tool { .. }));
    }
}