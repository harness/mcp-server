pub mod provider;
pub mod session;
pub mod jwt;

pub use provider::{AuthProvider, ApiKeyProvider, BearerTokenProvider};
pub use session::{AuthSession, Principal};
pub use jwt::{JwtClaims, JwtValidator};

use thiserror::Error;

/// Result type for authentication operations
pub type Result<T> = std::result::Result<T, AuthError>;

/// Authentication errors
#[derive(Error, Debug)]
pub enum AuthError {
    #[error("Invalid credentials")]
    InvalidCredentials,

    #[error("Token expired")]
    TokenExpired,

    #[error("Invalid token format")]
    InvalidTokenFormat,

    #[error("Insufficient permissions")]
    InsufficientPermissions,

    #[error("Account not found")]
    AccountNotFound,

    #[error("Session validation failed: {0}")]
    SessionValidation(String),

    #[error("JWT error: {0}")]
    Jwt(#[from] jsonwebtoken::errors::Error),

    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Unknown error: {0}")]
    Unknown(String),
}

impl AuthError {
    /// Create a new session validation error
    pub fn session_validation<S: Into<String>>(msg: S) -> Self {
        Self::SessionValidation(msg.into())
    }

    /// Create a new unknown error
    pub fn unknown<S: Into<String>>(msg: S) -> Self {
        Self::Unknown(msg.into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_auth_error_creation() {
        let err = AuthError::session_validation("test error");
        assert!(matches!(err, AuthError::SessionValidation(_)));
    }
}