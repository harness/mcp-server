pub mod api_key;
pub mod jwt;
pub mod session;
pub mod manager;

pub use manager::AuthManager;
pub use session::{AuthSession, Principal};

use thiserror::Error;

/// Authentication errors
#[derive(Error, Debug)]
pub enum AuthError {
    #[error("Invalid API key format")]
    InvalidApiKey,
    
    #[error("Invalid JWT token: {0}")]
    InvalidJwt(String),
    
    #[error("Authentication failed: {0}")]
    AuthenticationFailed(String),
    
    #[error("Authorization failed: {0}")]
    AuthorizationFailed(String),
    
    #[error("Token expired")]
    TokenExpired,
    
    #[error("HTTP request failed: {0}")]
    HttpError(#[from] reqwest::Error),
    
    #[error("JSON parsing error: {0}")]
    JsonError(#[from] serde_json::Error),
    
    #[error("JWT error: {0}")]
    JwtError(#[from] jsonwebtoken::errors::Error),
}