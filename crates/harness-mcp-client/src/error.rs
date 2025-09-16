use thiserror::Error;

/// Result type for client operations
pub type Result<T> = std::result::Result<T, ClientError>;

/// Client error types
#[derive(Error, Debug)]
pub enum ClientError {
    #[error("HTTP error: {status} - {message}")]
    Http { status: u16, message: String },

    #[error("Authentication error: {0}")]
    Authentication(String),

    #[error("Authorization error: {0}")]
    Authorization(String),

    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Rate limit exceeded: {0}")]
    RateLimit(String),

    #[error("Service unavailable: {0}")]
    ServiceUnavailable(String),

    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("URL parsing error: {0}")]
    UrlParsing(#[from] url::ParseError),

    #[error("Configuration error: {0}")]
    Configuration(String),

    #[error("Timeout error: {0}")]
    Timeout(String),

    #[error("Invalid response format: {0}")]
    InvalidResponse(String),

    #[error("Unknown error: {0}")]
    Unknown(String),
}

impl ClientError {
    /// Create a new HTTP error
    pub fn http(status: u16, message: String) -> Self {
        Self::Http { status, message }
    }

    /// Create a new authentication error
    pub fn authentication<S: Into<String>>(msg: S) -> Self {
        Self::Authentication(msg.into())
    }

    /// Create a new authorization error
    pub fn authorization<S: Into<String>>(msg: S) -> Self {
        Self::Authorization(msg.into())
    }

    /// Create a new bad request error
    pub fn bad_request<S: Into<String>>(msg: S) -> Self {
        Self::BadRequest(msg.into())
    }

    /// Create a new not found error
    pub fn not_found<S: Into<String>>(msg: S) -> Self {
        Self::NotFound(msg.into())
    }

    /// Create a new rate limit error
    pub fn rate_limit<S: Into<String>>(msg: S) -> Self {
        Self::RateLimit(msg.into())
    }

    /// Create a new service unavailable error
    pub fn service_unavailable<S: Into<String>>(msg: S) -> Self {
        Self::ServiceUnavailable(msg.into())
    }

    /// Create a new configuration error
    pub fn configuration<S: Into<String>>(msg: S) -> Self {
        Self::Configuration(msg.into())
    }

    /// Create a new timeout error
    pub fn timeout<S: Into<String>>(msg: S) -> Self {
        Self::Timeout(msg.into())
    }

    /// Create a new invalid response error
    pub fn invalid_response<S: Into<String>>(msg: S) -> Self {
        Self::InvalidResponse(msg.into())
    }

    /// Create a new unknown error
    pub fn unknown<S: Into<String>>(msg: S) -> Self {
        Self::Unknown(msg.into())
    }

    /// Get the HTTP status code for this error
    pub fn status_code(&self) -> u16 {
        match self {
            Self::Http { status, .. } => *status,
            Self::Authentication(_) => 401,
            Self::Authorization(_) => 403,
            Self::BadRequest(_) => 400,
            Self::NotFound(_) => 404,
            Self::RateLimit(_) => 429,
            Self::ServiceUnavailable(_) => 503,
            Self::Network(_) => 502,
            Self::Serialization(_) => 400,
            Self::UrlParsing(_) => 400,
            Self::Configuration(_) => 500,
            Self::Timeout(_) => 408,
            Self::InvalidResponse(_) => 502,
            Self::Unknown(_) => 500,
        }
    }

    /// Check if this error is retryable
    pub fn is_retryable(&self) -> bool {
        match self {
            Self::Http { status, .. } => matches!(*status, 429 | 500..=599),
            Self::RateLimit(_) | Self::ServiceUnavailable(_) => true,
            Self::Network(_) | Self::Timeout(_) => true,
            _ => false,
        }
    }

    /// Check if this error is a client error (4xx)
    pub fn is_client_error(&self) -> bool {
        let status = self.status_code();
        (400..500).contains(&status)
    }

    /// Check if this error is a server error (5xx)
    pub fn is_server_error(&self) -> bool {
        let status = self.status_code();
        (500..600).contains(&status)
    }
}

/// Convert HTTP status codes to ClientError
impl From<reqwest::StatusCode> for ClientError {
    fn from(status: reqwest::StatusCode) -> Self {
        let status_code = status.as_u16();
        let message = status.canonical_reason().unwrap_or("Unknown error").to_string();

        match status_code {
            400 => Self::BadRequest(message),
            401 => Self::Authentication(message),
            403 => Self::Authorization(message),
            404 => Self::NotFound(message),
            408 => Self::Timeout(message),
            429 => Self::RateLimit(message),
            503 => Self::ServiceUnavailable(message),
            _ => Self::Http {
                status: status_code,
                message,
            },
        }
    }
}

/// Error context for better error reporting
#[derive(Debug, Clone)]
pub struct ErrorContext {
    pub operation: String,
    pub resource: Option<String>,
    pub scope: Option<String>,
    pub request_id: Option<String>,
}

impl ErrorContext {
    /// Create a new error context
    pub fn new<S: Into<String>>(operation: S) -> Self {
        Self {
            operation: operation.into(),
            resource: None,
            scope: None,
            request_id: None,
        }
    }

    /// Set the resource
    pub fn with_resource<S: Into<String>>(mut self, resource: S) -> Self {
        self.resource = Some(resource.into());
        self
    }

    /// Set the scope
    pub fn with_scope<S: Into<String>>(mut self, scope: S) -> Self {
        self.scope = Some(scope.into());
        self
    }

    /// Set the request ID
    pub fn with_request_id<S: Into<String>>(mut self, request_id: S) -> Self {
        self.request_id = Some(request_id.into());
        self
    }
}

/// Enhanced error with context
#[derive(Error, Debug)]
#[error("{context:?}: {source}")]
pub struct ContextualError {
    pub context: ErrorContext,
    #[source]
    pub source: ClientError,
}

impl ContextualError {
    /// Create a new contextual error
    pub fn new(context: ErrorContext, source: ClientError) -> Self {
        Self { context, source }
    }

    /// Create a contextual error with operation
    pub fn with_operation<S: Into<String>>(operation: S, source: ClientError) -> Self {
        Self::new(ErrorContext::new(operation), source)
    }
}

/// Retry configuration for handling transient errors
#[derive(Debug, Clone)]
pub struct RetryConfig {
    pub max_attempts: u32,
    pub initial_delay: std::time::Duration,
    pub max_delay: std::time::Duration,
    pub backoff_multiplier: f64,
    pub jitter: bool,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_attempts: 3,
            initial_delay: std::time::Duration::from_millis(100),
            max_delay: std::time::Duration::from_secs(30),
            backoff_multiplier: 2.0,
            jitter: true,
        }
    }
}

impl RetryConfig {
    /// Create a new retry configuration
    pub fn new(max_attempts: u32) -> Self {
        Self {
            max_attempts,
            ..Default::default()
        }
    }

    /// Set the initial delay
    pub fn with_initial_delay(mut self, delay: std::time::Duration) -> Self {
        self.initial_delay = delay;
        self
    }

    /// Set the maximum delay
    pub fn with_max_delay(mut self, delay: std::time::Duration) -> Self {
        self.max_delay = delay;
        self
    }

    /// Set the backoff multiplier
    pub fn with_backoff_multiplier(mut self, multiplier: f64) -> Self {
        self.backoff_multiplier = multiplier;
        self
    }

    /// Enable or disable jitter
    pub fn with_jitter(mut self, jitter: bool) -> Self {
        self.jitter = jitter;
        self
    }

    /// Calculate the delay for a given attempt
    pub fn delay_for_attempt(&self, attempt: u32) -> std::time::Duration {
        if attempt == 0 {
            return std::time::Duration::ZERO;
        }

        let delay_ms = self.initial_delay.as_millis() as f64
            * self.backoff_multiplier.powi((attempt - 1) as i32);

        let delay = std::time::Duration::from_millis(delay_ms as u64);
        let capped_delay = std::cmp::min(delay, self.max_delay);

        if self.jitter {
            // Add up to 25% jitter
            let jitter_factor = 1.0 + (rand::random::<f64>() - 0.5) * 0.5;
            let jittered_ms = capped_delay.as_millis() as f64 * jitter_factor;
            std::time::Duration::from_millis(jittered_ms as u64)
        } else {
            capped_delay
        }
    }

    /// Check if an error should be retried
    pub fn should_retry(&self, error: &ClientError, attempt: u32) -> bool {
        attempt < self.max_attempts && error.is_retryable()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_client_error_creation() {
        let err = ClientError::authentication("Invalid token");
        assert_eq!(err.status_code(), 401);
        assert!(!err.is_retryable());
        assert!(err.is_client_error());
        assert!(!err.is_server_error());
    }

    #[test]
    fn test_retryable_errors() {
        assert!(ClientError::rate_limit("Too many requests").is_retryable());
        assert!(ClientError::service_unavailable("Service down").is_retryable());
        assert!(!ClientError::bad_request("Invalid input").is_retryable());
        assert!(!ClientError::not_found("Resource not found").is_retryable());
    }

    #[test]
    fn test_status_code_conversion() {
        let err = ClientError::from(reqwest::StatusCode::NOT_FOUND);
        assert_eq!(err.status_code(), 404);
        assert!(matches!(err, ClientError::NotFound(_)));
    }

    #[test]
    fn test_error_context() {
        let context = ErrorContext::new("list_pipelines")
            .with_resource("pipeline")
            .with_scope("account/org/project")
            .with_request_id("req-123");

        assert_eq!(context.operation, "list_pipelines");
        assert_eq!(context.resource, Some("pipeline".to_string()));
        assert_eq!(context.scope, Some("account/org/project".to_string()));
        assert_eq!(context.request_id, Some("req-123".to_string()));
    }

    #[test]
    fn test_contextual_error() {
        let source = ClientError::not_found("Pipeline not found");
        let context = ErrorContext::new("get_pipeline").with_resource("pipeline-123");
        let contextual = ContextualError::new(context, source);

        assert_eq!(contextual.context.operation, "get_pipeline");
        assert_eq!(contextual.context.resource, Some("pipeline-123".to_string()));
    }

    #[test]
    fn test_retry_config() {
        let config = RetryConfig::new(5)
            .with_initial_delay(std::time::Duration::from_millis(200))
            .with_max_delay(std::time::Duration::from_secs(10))
            .with_backoff_multiplier(1.5)
            .with_jitter(false);

        assert_eq!(config.max_attempts, 5);
        assert_eq!(config.initial_delay, std::time::Duration::from_millis(200));
        assert_eq!(config.backoff_multiplier, 1.5);
        assert!(!config.jitter);

        // Test delay calculation
        let delay1 = config.delay_for_attempt(1);
        let delay2 = config.delay_for_attempt(2);
        assert_eq!(delay1, std::time::Duration::from_millis(200));
        assert_eq!(delay2, std::time::Duration::from_millis(300));
    }

    #[test]
    fn test_retry_should_retry() {
        let config = RetryConfig::new(3);
        
        let retryable_error = ClientError::rate_limit("Rate limited");
        let non_retryable_error = ClientError::bad_request("Invalid input");

        assert!(config.should_retry(&retryable_error, 1));
        assert!(config.should_retry(&retryable_error, 2));
        assert!(!config.should_retry(&retryable_error, 3));
        assert!(!config.should_retry(&non_retryable_error, 1));
    }
}