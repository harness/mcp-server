use crate::{AuthError, AuthSession, Principal, api_key, jwt};
use harness_config::Config;
use std::sync::Arc;
use tracing::{info, debug};

/// Authentication manager
/// Migrated from Go auth patterns
pub struct AuthManager {
    config: Arc<Config>,
}

impl AuthManager {
    /// Create a new authentication manager
    pub async fn new(config: Arc<Config>) -> Result<Self, AuthError> {
        info!("Initializing authentication manager");
        
        Ok(Self { config })
    }
    
    /// Authenticate using API key
    pub async fn authenticate_api_key(&self, api_key: &str) -> Result<AuthSession, AuthError> {
        debug!("Authenticating with API key");
        
        api_key::authenticate_with_api_key(
            api_key,
            self.config.default_org_id.clone(),
            self.config.default_project_id.clone(),
        )
    }
    
    /// Authenticate using bearer token
    pub async fn authenticate_bearer_token(&self, token: &str) -> Result<AuthSession, AuthError> {
        debug!("Authenticating with bearer token");
        
        if let Some(secret) = &self.config.mcp_svc_secret {
            jwt::authenticate_session(token, secret)
        } else {
            Err(AuthError::AuthenticationFailed(
                "MCP service secret not configured".to_string()
            ))
        }
    }
    
    /// Get current authentication session based on config
    pub async fn get_current_session(&self) -> Result<AuthSession, AuthError> {
        if self.config.internal {
            if let Some(bearer_token) = &self.config.bearer_token {
                self.authenticate_bearer_token(bearer_token).await
            } else {
                Err(AuthError::AuthenticationFailed(
                    "Bearer token required for internal mode".to_string()
                ))
            }
        } else {
            if let Some(api_key) = &self.config.api_key {
                self.authenticate_api_key(api_key).await
            } else {
                Err(AuthError::AuthenticationFailed(
                    "API key required for external mode".to_string()
                ))
            }
        }
    }
    
    /// Check if current session is valid
    pub async fn validate_session(&self, session: &AuthSession) -> Result<bool, AuthError> {
        // Check if session is expired
        if session.is_expired() {
            return Ok(false);
        }
        
        // Additional validation logic can be added here
        Ok(true)
    }
}