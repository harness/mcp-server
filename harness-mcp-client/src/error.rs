use thiserror::Error;

pub type Result<T> = std::result::Result<T, ClientError>;

#[derive(Error, Debug)]
pub enum ClientError {
    #[error("HTTP request failed: {0}")]
    Http(#[from] reqwest::Error),

    #[error("Authentication failed: {0}")]
    Auth(String),

    #[error("API error: {status} - {message}")]
    Api { status: u16, message: String },

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Invalid URL: {0}")]
    InvalidUrl(String),

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Timeout error: {0}")]
    Timeout(String),

    #[error("Rate limit exceeded")]
    RateLimit,

    #[error("Internal error: {0}")]
    Internal(String),
}

impl ClientError {
    pub fn auth<S: Into<String>>(message: S) -> Self {
        Self::Auth(message.into())
    }

    pub fn api(status: u16, message: String) -> Self {
        Self::Api { status, message }
    }

    pub fn invalid_url<S: Into<String>>(url: S) -> Self {
        Self::InvalidUrl(url.into())
    }

    pub fn config<S: Into<String>>(message: S) -> Self {
        Self::Config(message.into())
    }

    pub fn timeout<S: Into<String>>(message: S) -> Self {
        Self::Timeout(message.into())
    }

    pub fn internal<S: Into<String>>(message: S) -> Self {
        Self::Internal(message.into())
    }

    /// Check if the error is retryable
    pub fn is_retryable(&self) -> bool {
        match self {
            ClientError::Http(e) => {
                // Retry on network errors, timeouts, etc.
                e.is_timeout() || e.is_connect() || e.is_request()
            }
            ClientError::Api { status, .. } => {
                // Retry on 5xx server errors and some 4xx errors
                *status >= 500 || *status == 429 || *status == 408
            }
            ClientError::Timeout(_) => true,
            ClientError::RateLimit => true,
            _ => false,
        }
    }

    /// Get the HTTP status code if available
    pub fn status_code(&self) -> Option<u16> {
        match self {
            ClientError::Http(e) => e.status().map(|s| s.as_u16()),
            ClientError::Api { status, .. } => Some(*status),
            ClientError::RateLimit => Some(429),
            _ => None,
        }
    }
}