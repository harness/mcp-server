use thiserror::Error;

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Error, Debug)]
pub enum Error {
    #[error("HTTP request failed: {0}")]
    Http(#[from] reqwest::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Authentication error: {0}")]
    Auth(#[from] harness_mcp_auth::AuthError),

    #[error("Configuration error: {0}")]
    Config(#[from] harness_mcp_config::ConfigError),

    #[error("API error: {status} - {message}")]
    Api { status: u16, message: String },

    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("Forbidden: {0}")]
    Forbidden(String),

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("Rate limited: {0}")]
    RateLimit(String),

    #[error("Internal server error: {0}")]
    Internal(String),

    #[error("Service unavailable: {0}")]
    ServiceUnavailable(String),

    #[error("Timeout: {0}")]
    Timeout(String),

    #[error("Network error: {0}")]
    Network(String),

    #[error("Invalid response format: {0}")]
    InvalidResponse(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Resource not found: {resource_type} with id '{id}'")]
    ResourceNotFound { resource_type: String, id: String },

    #[error("Operation failed: {operation} on {resource}: {reason}")]
    OperationFailed {
        operation: String,
        resource: String,
        reason: String,
    },
}

impl Error {
    pub fn from_status_code(status: reqwest::StatusCode, message: String) -> Self {
        match status.as_u16() {
            400 => Error::BadRequest(message),
            401 => Error::Unauthorized(message),
            403 => Error::Forbidden(message),
            404 => Error::NotFound(message),
            409 => Error::Conflict(message),
            429 => Error::RateLimit(message),
            500 => Error::Internal(message),
            503 => Error::ServiceUnavailable(message),
            _ => Error::Api {
                status: status.as_u16(),
                message,
            },
        }
    }

    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            Error::Timeout(_)
                | Error::Network(_)
                | Error::ServiceUnavailable(_)
                | Error::RateLimit(_)
                | Error::Http(_)
        )
    }

    pub fn is_auth_error(&self) -> bool {
        matches!(self, Error::Auth(_) | Error::Unauthorized(_))
    }
}
