use crate::{ApiKeyAuth, JwtAuth};
use harness_mcp_config::Config;
use reqwest::RequestBuilder;
use thiserror::Error;

pub type Result<T> = std::result::Result<T, AuthError>;

#[derive(Error, Debug)]
pub enum AuthError {
    #[error("Invalid API key format")]
    InvalidApiKey,

    #[error("JWT error: {0}")]
    Jwt(#[from] jsonwebtoken::errors::Error),

    #[error("Missing authentication credentials")]
    MissingCredentials,

    #[error("Authentication failed: {0}")]
    Failed(String),

    #[error("Token expired")]
    TokenExpired,

    #[error("Invalid token")]
    InvalidToken,

    #[error("Insufficient permissions")]
    InsufficientPermissions,
}

#[derive(Clone)]
pub enum AuthProvider {
    ApiKey(ApiKeyAuth),
    Jwt(JwtAuth),
}

impl AuthProvider {
    pub async fn new(config: &Config) -> Result<Self> {
        if config.is_internal() {
            // Internal mode uses JWT/bearer token
            if let Some(bearer_token) = &config.bearer_token {
                Ok(AuthProvider::Jwt(JwtAuth::new(bearer_token.clone())))
            } else {
                Err(AuthError::MissingCredentials)
            }
        } else {
            // External mode uses API key
            if let Some(api_key) = &config.api_key {
                Ok(AuthProvider::ApiKey(ApiKeyAuth::new(api_key.clone())?))
            } else {
                Err(AuthError::MissingCredentials)
            }
        }
    }

    pub async fn add_auth_headers(&self, request: RequestBuilder) -> Result<RequestBuilder> {
        match self {
            AuthProvider::ApiKey(auth) => auth.add_headers(request).await,
            AuthProvider::Jwt(auth) => auth.add_headers(request).await,
        }
    }
}
