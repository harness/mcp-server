//! Authentication implementations for Harness API

use crate::error::{HarnessError, Result};
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use serde::{Deserialize, Serialize};

/// Authentication provider trait
pub trait AuthProvider: Send + Sync {
    /// Get the authentication header key and value
    fn get_header(&self) -> Result<(String, String)>;
    
    /// Validate the authentication
    fn validate(&self) -> Result<()>;
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
    pub fn extract_account_id(&self) -> Result<String> {
        let parts: Vec<&str> = self.api_key.split('.').collect();
        if parts.len() >= 2 {
            Ok(parts[1].to_string())
        } else {
            Err(HarnessError::Auth("Invalid API key format".to_string()))
        }
    }
}

impl AuthProvider for ApiKeyAuth {
    fn get_header(&self) -> Result<(String, String)> {
        Ok(("x-api-key".to_string(), self.api_key.clone()))
    }

    fn validate(&self) -> Result<()> {
        if self.api_key.is_empty() {
            return Err(HarnessError::Auth("API key is empty".to_string()));
        }
        
        // Validate API key format (pat.ACCOUNT_ID.TOKEN_ID.*)
        let parts: Vec<&str> = self.api_key.split('.').collect();
        if parts.len() < 3 || parts[0] != "pat" {
            return Err(HarnessError::Auth("Invalid API key format".to_string()));
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
    fn get_header(&self) -> Result<(String, String)> {
        Ok(("Authorization".to_string(), format!("Bearer {}", self.token)))
    }

    fn validate(&self) -> Result<()> {
        if self.token.is_empty() {
            return Err(HarnessError::Auth("Bearer token is empty".to_string()));
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
    pub fn decode_token(&self) -> Result<JwtClaims> {
        let key = DecodingKey::from_secret(self.secret.as_ref());
        let validation = Validation::new(Algorithm::HS256);

        let token_data = decode::<JwtClaims>(&self.token, &key, &validation)
            .map_err(|e| HarnessError::Auth(format!("JWT validation failed: {}", e)))?;

        Ok(token_data.claims)
    }
}

impl AuthProvider for JwtAuth {
    fn get_header(&self) -> Result<(String, String)> {
        Ok(("Authorization".to_string(), format!("Bearer {}", self.token)))
    }

    fn validate(&self) -> Result<()> {
        if self.token.is_empty() {
            return Err(HarnessError::Auth("JWT token is empty".to_string()));
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
        let now = chrono::Utc::now().timestamp();
        self.exp < now
    }

    /// Get the expiration time as DateTime
    pub fn expiration_time(&self) -> Option<chrono::DateTime<chrono::Utc>> {
        chrono::DateTime::from_timestamp(self.exp, 0)
    }

    /// Get the issued at time as DateTime
    pub fn issued_at_time(&self) -> Option<chrono::DateTime<chrono::Utc>> {
        chrono::DateTime::from_timestamp(self.iat, 0)
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
    fn test_bearer_token_auth_empty() {
        let auth = BearerTokenAuth::new("".to_string());
        assert!(auth.validate().is_err());
    }

    #[test]
    fn test_jwt_auth_empty_token() {
        let auth = JwtAuth::new("".to_string(), "secret".to_string());
        assert!(auth.validate().is_err());
    }
}