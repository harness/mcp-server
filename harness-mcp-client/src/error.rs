use thiserror::Error;

pub type Result<T> = std::result::Result<T, ClientError>;

#[derive(Error, Debug)]
pub enum ClientError {
    #[error("HTTP error: {0}")]
    HttpError(#[from] reqwest::Error),

    #[error("JSON serialization error: {0}")]
    JsonError(#[from] serde_json::Error),

    #[error("API error {status}: {message}")]
    ApiError { status: u16, message: String },

    #[error("Authentication error: {0}")]
    AuthError(String),

    #[error("Rate limit exceeded")]
    RateLimitError,

    #[error("Timeout error")]
    TimeoutError,

    #[error("Configuration error: {0}")]
    ConfigError(String),
}

impl ClientError {
    pub fn is_retryable(&self) -> bool {
        match self {
            ClientError::HttpError(e) => e.is_timeout() || e.is_connect(),
            ClientError::ApiError { status, .. } => *status >= 500 || *status == 429,
            ClientError::RateLimitError | ClientError::TimeoutError => true,
            _ => false,
        }
    }
}