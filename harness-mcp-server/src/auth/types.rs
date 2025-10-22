//! Authentication types and traits

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Authentication provider trait
pub trait AuthProvider: Send + Sync {
    /// Get the authentication header key and value
    fn get_header(&self) -> Result<(String, String), crate::error::ServerError>;
    
    /// Validate the authentication
    fn validate(&self) -> Result<(), crate::error::ServerError>;
}

/// API key authentication
#[derive(Debug, Clone)]
pub struct ApiKeyAuth {
    pub api_key: String,
}

impl ApiKeyAuth {
    /// Create a new API key auth
    pub fn new(api_key: String) -> Self {
        Self { api_key }
    }

    /// Extract account ID from API key
    pub fn extract_account_id(&self) -> Result<String, crate::error::ServerError> {
        let parts: Vec<&str> = self.api_key.split('.').collect();
        if parts.len() >= 2 {
            Ok(parts[1].to_string())
        } else {
            Err(crate::error::ServerError::Auth("Invalid API key format".to_string()))
        }
    }
}

impl AuthProvider for ApiKeyAuth {
    fn get_header(&self) -> Result<(String, String), crate::error::ServerError> {
        Ok(("x-api-key".to_string(), self.api_key.clone()))
    }

    fn validate(&self) -> Result<(), crate::error::ServerError> {
        if self.api_key.is_empty() {
            return Err(crate::error::ServerError::Auth("API key is empty".to_string()));
        }
        
        // Validate API key format (pat.ACCOUNT_ID.TOKEN_ID.*)
        let parts: Vec<&str> = self.api_key.split('.').collect();
        if parts.len() < 3 || parts[0] != "pat" {
            return Err(crate::error::ServerError::Auth("Invalid API key format".to_string()));
        }
        
        Ok(())
    }
}

/// Bearer token authentication
#[derive(Debug, Clone)]
pub struct BearerTokenAuth {
    pub token: String,
}

impl BearerTokenAuth {
    /// Create a new bearer token auth
    pub fn new(token: String) -> Self {
        Self { token }
    }
}

impl AuthProvider for BearerTokenAuth {
    fn get_header(&self) -> Result<(String, String), crate::error::ServerError> {
        Ok(("Authorization".to_string(), format!("Bearer {}", self.token)))
    }

    fn validate(&self) -> Result<(), crate::error::ServerError> {
        if self.token.is_empty() {
            return Err(crate::error::ServerError::Auth("Bearer token is empty".to_string()));
        }
        Ok(())
    }
}

/// JWT authentication
#[derive(Debug, Clone)]
pub struct JwtAuth {
    pub token: String,
    pub secret: String,
}

impl JwtAuth {
    /// Create a new JWT auth
    pub fn new(token: String, secret: String) -> Self {
        Self { token, secret }
    }

    /// Validate and decode the JWT token
    pub fn decode_token(&self) -> Result<JwtClaims, crate::error::ServerError> {
        use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};

        let key = DecodingKey::from_secret(self.secret.as_ref());
        let validation = Validation::new(Algorithm::HS256);

        let token_data = decode::<JwtClaims>(&self.token, &key, &validation)
            .map_err(|e| crate::error::ServerError::Auth(format!("JWT validation failed: {}", e)))?;

        Ok(token_data.claims)
    }
}

impl AuthProvider for JwtAuth {
    fn get_header(&self) -> Result<(String, String), crate::error::ServerError> {
        Ok(("Authorization".to_string(), format!("Bearer {}", self.token)))
    }

    fn validate(&self) -> Result<(), crate::error::ServerError> {
        if self.token.is_empty() {
            return Err(crate::error::ServerError::Auth("JWT token is empty".to_string()));
        }
        
        // Validate the token
        self.decode_token()?;
        Ok(())
    }
}

/// JWT claims structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JwtClaims {
    pub sub: String,                    // Subject (user ID)
    pub iss: String,                    // Issuer
    pub aud: String,                    // Audience
    pub exp: i64,                       // Expiration time
    pub iat: i64,                       // Issued at
    pub account_id: Option<String>,     // Account ID
    pub org_id: Option<String>,         // Organization ID
    pub project_id: Option<String>,     // Project ID
    pub user_id: Option<String>,        // User ID
    pub email: Option<String>,          // User email
    pub roles: Option<Vec<String>>,     // User roles
    pub permissions: Option<Vec<String>>, // User permissions
}

impl JwtClaims {
    /// Check if the token is expired
    pub fn is_expired(&self) -> bool {
        let now = Utc::now().timestamp();
        self.exp < now
    }

    /// Get the expiration time as DateTime
    pub fn expiration_time(&self) -> Option<DateTime<Utc>> {
        DateTime::from_timestamp(self.exp, 0)
    }

    /// Get the issued at time as DateTime
    pub fn issued_at_time(&self) -> Option<DateTime<Utc>> {
        DateTime::from_timestamp(self.iat, 0)
    }
}

/// Authentication session information
#[derive(Debug, Clone)]
pub struct AuthSession {
    pub principal: Principal,
    pub account_id: String,
    pub org_id: Option<String>,
    pub project_id: Option<String>,
    pub permissions: Vec<String>,
    pub expires_at: Option<DateTime<Utc>>,
}

impl AuthSession {
    /// Create a new auth session
    pub fn new(principal: Principal, account_id: String) -> Self {
        Self {
            principal,
            account_id,
            org_id: None,
            project_id: None,
            permissions: Vec::new(),
            expires_at: None,
        }
    }

    /// Set organization ID
    pub fn with_org_id(mut self, org_id: String) -> Self {
        self.org_id = Some(org_id);
        self
    }

    /// Set project ID
    pub fn with_project_id(mut self, project_id: String) -> Self {
        self.project_id = Some(project_id);
        self
    }

    /// Set permissions
    pub fn with_permissions(mut self, permissions: Vec<String>) -> Self {
        self.permissions = permissions;
        self
    }

    /// Set expiration time
    pub fn with_expiration(mut self, expires_at: DateTime<Utc>) -> Self {
        self.expires_at = Some(expires_at);
        self
    }

    /// Check if the session is expired
    pub fn is_expired(&self) -> bool {
        if let Some(expires_at) = self.expires_at {
            Utc::now() > expires_at
        } else {
            false
        }
    }

    /// Check if the session has a specific permission
    pub fn has_permission(&self, permission: &str) -> bool {
        self.permissions.contains(&permission.to_string())
    }
}

/// Principal information
#[derive(Debug, Clone)]
pub struct Principal {
    pub principal_type: PrincipalType,
    pub principal_id: String,
    pub account_id: String,
    pub user_id: Option<String>,
    pub email: Option<String>,
    pub name: Option<String>,
}

/// Principal types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum PrincipalType {
    User,
    ServiceAccount,
    ApiKey,
    System,
}

/// Authentication context for requests
#[derive(Debug, Clone)]
pub struct AuthContext {
    pub session: AuthSession,
    pub request_id: String,
    pub client_ip: Option<String>,
    pub user_agent: Option<String>,
    pub metadata: HashMap<String, String>,
}

impl AuthContext {
    /// Create a new auth context
    pub fn new(session: AuthSession, request_id: String) -> Self {
        Self {
            session,
            request_id,
            client_ip: None,
            user_agent: None,
            metadata: HashMap::new(),
        }
    }

    /// Set client IP
    pub fn with_client_ip(mut self, client_ip: String) -> Self {
        self.client_ip = Some(client_ip);
        self
    }

    /// Set user agent
    pub fn with_user_agent(mut self, user_agent: String) -> Self {
        self.user_agent = Some(user_agent);
        self
    }

    /// Add metadata
    pub fn with_metadata(mut self, key: String, value: String) -> Self {
        self.metadata.insert(key, value);
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_api_key_auth() {
        let auth = ApiKeyAuth::new("pat.account123.token456.suffix".to_string());
        
        assert!(auth.validate().is_ok());
        
        let account_id = auth.extract_account_id().unwrap();
        assert_eq!(account_id, "account123");
        
        let (key, value) = auth.get_header().unwrap();
        assert_eq!(key, "x-api-key");
        assert_eq!(value, "pat.account123.token456.suffix");
    }

    #[test]
    fn test_api_key_auth_invalid() {
        let auth = ApiKeyAuth::new("invalid_key".to_string());
        assert!(auth.validate().is_err());
        assert!(auth.extract_account_id().is_err());
    }

    #[test]
    fn test_bearer_token_auth() {
        let auth = BearerTokenAuth::new("token123".to_string());
        
        assert!(auth.validate().is_ok());
        
        let (key, value) = auth.get_header().unwrap();
        assert_eq!(key, "Authorization");
        assert_eq!(value, "Bearer token123");
    }

    #[test]
    fn test_auth_session() {
        let principal = Principal {
            principal_type: PrincipalType::User,
            principal_id: "user123".to_string(),
            account_id: "account123".to_string(),
            user_id: Some("user123".to_string()),
            email: Some("user@example.com".to_string()),
            name: Some("Test User".to_string()),
        };

        let session = AuthSession::new(principal, "account123".to_string())
            .with_permissions(vec!["read".to_string(), "write".to_string()]);

        assert_eq!(session.account_id, "account123");
        assert!(session.has_permission("read"));
        assert!(session.has_permission("write"));
        assert!(!session.has_permission("admin"));
        assert!(!session.is_expired());
    }
}