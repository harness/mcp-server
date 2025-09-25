//! Authentication provider implementations

use crate::error::{Error, Result};
use crate::session::{Session, Principal};
use async_trait::async_trait;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

/// Authentication provider trait
#[async_trait]
pub trait AuthProvider: Send + Sync {
    /// Add authentication headers to a request
    async fn add_auth_headers(&self, headers: &mut HeaderMap) -> Result<()>;
    
    /// Get the account ID associated with this auth provider
    fn get_account_id(&self) -> Option<String>;
}

/// API key authentication provider
#[derive(Clone)]
pub struct ApiKeyProvider {
    api_key: String,
    account_id: String,
}

impl ApiKeyProvider {
    /// Create a new API key provider
    pub fn new(api_key: String) -> Result<Self> {
        let account_id = extract_account_id_from_api_key(&api_key)?;
        Ok(Self { api_key, account_id })
    }
}

#[async_trait]
impl AuthProvider for ApiKeyProvider {
    async fn add_auth_headers(&self, headers: &mut HeaderMap) -> Result<()> {
        // Use x-api-key header for API key authentication (matching Go implementation)
        let auth_value = HeaderValue::from_str(&self.api_key)
            .map_err(|e| Error::Generic(format!("Invalid API key format: {}", e)))?;
        headers.insert("x-api-key", auth_value);
        Ok(())
    }
    
    fn get_account_id(&self) -> Option<String> {
        Some(self.account_id.clone())
    }
}

/// Bearer token authentication provider
#[derive(Clone)]
pub struct BearerTokenProvider {
    token: String,
    account_id: Option<String>,
}

impl BearerTokenProvider {
    /// Create a new bearer token provider
    pub fn new(token: String, account_id: Option<String>) -> Self {
        Self { token, account_id }
    }
}

#[async_trait]
impl AuthProvider for BearerTokenProvider {
    async fn add_auth_headers(&self, headers: &mut HeaderMap) -> Result<()> {
        let auth_value = HeaderValue::from_str(&format!("Bearer {}", self.token))
            .map_err(|e| Error::Generic(format!("Invalid token format: {}", e)))?;
        headers.insert(AUTHORIZATION, auth_value);
        Ok(())
    }
    
    fn get_account_id(&self) -> Option<String> {
        self.account_id.clone()
    }
}

/// JWT authentication provider
#[derive(Clone)]
pub struct JwtProvider {
    secret: String,
    service_identity: String,
    lifetime: Duration,
    session: Option<Session>,
}

impl JwtProvider {
    /// Create a new JWT provider
    pub fn new(secret: String, service_identity: String, lifetime: Duration) -> Self {
        Self {
            secret,
            service_identity,
            lifetime,
            session: None,
        }
    }

    /// Set the session for JWT generation
    pub fn with_session(mut self, session: Session) -> Self {
        self.session = Some(session);
        self
    }

    /// Generate JWT token from session
    fn generate_token(&self) -> Result<String> {
        let session = self.session.as_ref()
            .ok_or_else(|| Error::AuthenticationFailed("No session available for JWT generation".to_string()))?;

        let claims = crate::jwt::Claims::new_user_claims(
            session.principal.uid.clone(),
            session.principal.email.clone(),
            session.principal.display_name.clone(),
            session.principal.account_id.clone(),
            self.lifetime,
        )?;

        crate::jwt::encode_token(&claims, self.secret.as_bytes())
    }
}

#[async_trait]
impl AuthProvider for JwtProvider {
    async fn add_auth_headers(&self, headers: &mut HeaderMap) -> Result<()> {
        let token = self.generate_token()?;
        let auth_value = HeaderValue::from_str(&format!("{} {}", self.service_identity, token))
            .map_err(|e| Error::Generic(format!("Invalid JWT format: {}", e)))?;
        headers.insert(AUTHORIZATION, auth_value);
        Ok(())
    }
    
    fn get_account_id(&self) -> Option<String> {
        self.session.as_ref().map(|s| s.principal.account_id.clone())
    }
}

/// Extract account ID from Harness API key
/// API key format: pat.ACCOUNT_ID.TOKEN_ID.<>
fn extract_account_id_from_api_key(api_key: &str) -> Result<String> {
    let parts: Vec<&str> = api_key.split('.').collect();
    if parts.len() < 2 {
        return Err(Error::InvalidApiKey("Invalid API key format".to_string()));
    }
    Ok(parts[1].to_string())
}