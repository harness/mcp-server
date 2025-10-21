pub mod middleware;
#[cfg(test)]
mod tests;

use crate::error::{HarnessError, Result};
use serde::{Deserialize, Serialize};
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use std::collections::HashMap;
use tracing::{debug, info, warn};
use base64::{Engine as _, engine::general_purpose};
use std::time::{SystemTime, UNIX_EPOCH};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthSession {
    pub principal: Principal,
    pub token: String,
    pub token_type: TokenType,
    pub expires_at: Option<DateTime<Utc>>,
    pub scopes: Vec<String>,
    pub permissions: HashMap<String, Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Principal {
    pub account_id: String,
    pub user_id: Option<String>,
    pub email: Option<String>,
    pub name: Option<String>,
    pub user_type: Option<UserType>,
    pub default_account_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TokenType {
    ApiKey,
    BearerToken,
    ServiceAccount,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum UserType {
    User,
    ServiceAccount,
    System,
}

#[derive(Debug, Serialize, Deserialize)]
struct JwtClaims {
    sub: String,
    #[serde(rename = "accountId")]
    account_id: String,
    email: Option<String>,
    name: Option<String>,
    #[serde(rename = "userType")]
    user_type: Option<String>,
    scopes: Option<Vec<String>>,
    permissions: Option<HashMap<String, Vec<String>>>,
    exp: usize,
    iat: Option<usize>,
    iss: Option<String>,
    aud: Option<String>,
}

impl AuthSession {
    /// Authenticate using a bearer token (for internal mode)
    pub async fn authenticate(bearer_token: &str, mcp_secret: &str) -> Result<Self> {
        let token = bearer_token.strip_prefix("Bearer ").unwrap_or(bearer_token);
        
        debug!("Authenticating bearer token");
        
        // Decode the JWT token
        let mut validation = Validation::new(Algorithm::HS256);
        validation.validate_exp = true;
        validation.validate_aud = false; // Allow missing audience
        
        let decoding_key = DecodingKey::from_secret(mcp_secret.as_ref());
        
        let token_data = decode::<JwtClaims>(token, &decoding_key, &validation)
            .map_err(|e| {
                warn!("Token validation failed: {}", e);
                HarnessError::Auth(format!("Invalid token: {}", e))
            })?;
        
        let claims = token_data.claims;
        
        // Parse user type
        let user_type = claims.user_type.as_ref().and_then(|ut| match ut.as_str() {
            "USER" => Some(UserType::User),
            "SERVICE_ACCOUNT" => Some(UserType::ServiceAccount),
            "SYSTEM" => Some(UserType::System),
            _ => None,
        });
        
        // Calculate expiration time
        let expires_at = DateTime::from_timestamp(claims.exp as i64, 0);
        
        let principal = Principal {
            account_id: claims.account_id.clone(),
            user_id: Some(claims.sub),
            email: claims.email,
            name: claims.name,
            user_type,
            default_account_id: Some(claims.account_id.clone()),
        };
        
        info!("Successfully authenticated user for account: {}", claims.account_id);
        
        Ok(AuthSession {
            principal,
            token: token.to_string(),
            token_type: TokenType::BearerToken,
            expires_at,
            scopes: claims.scopes.unwrap_or_default(),
            permissions: claims.permissions.unwrap_or_default(),
        })
    }
    
    /// Create session from API key (for external mode)
    pub fn from_api_key(api_key: &str) -> Result<Self> {
        let account_id = Self::extract_account_id_from_api_key(api_key)?;
        
        debug!("Creating session from API key for account: {}", account_id);
        
        let principal = Principal {
            account_id: account_id.clone(),
            user_id: None,
            email: None,
            name: None,
            user_type: Some(UserType::ServiceAccount),
            default_account_id: Some(account_id),
        };
        
        Ok(AuthSession {
            principal,
            token: api_key.to_string(),
            token_type: TokenType::ApiKey,
            expires_at: None, // API keys don't expire
            scopes: vec!["*".to_string()], // API keys have full access
            permissions: HashMap::new(),
        })
    }
    
    /// Check if the session is expired
    pub fn is_expired(&self) -> bool {
        match self.expires_at {
            Some(expires_at) => Utc::now() > expires_at,
            None => false, // No expiration means never expired
        }
    }
    
    /// Check if the session has a specific scope
    pub fn has_scope(&self, scope: &str) -> bool {
        self.scopes.contains(&scope.to_string()) || self.scopes.contains(&"*".to_string())
    }
    
    /// Check if the session has a specific permission
    pub fn has_permission(&self, resource: &str, action: &str) -> bool {
        if let Some(actions) = self.permissions.get(resource) {
            actions.contains(&action.to_string()) || actions.contains(&"*".to_string())
        } else {
            // If no specific permissions, check for wildcard
            self.has_scope("*")
        }
    }
    
    /// Extract account ID from Harness API key
    /// API key format: pat.ACCOUNT_ID.TOKEN_ID.<signature>
    pub fn extract_account_id_from_api_key(api_key: &str) -> Result<String> {
        let parts: Vec<&str> = api_key.split('.').collect();
        if parts.len() < 2 {
            return Err(HarnessError::Auth("Invalid API key format - expected pat.ACCOUNT_ID.TOKEN_ID.SIGNATURE".to_string()));
        }
        
        if parts[0] != "pat" {
            return Err(HarnessError::Auth("Invalid API key format - must start with 'pat'".to_string()));
        }
        
        let account_id = parts[1];
        if account_id.is_empty() {
            return Err(HarnessError::Auth("Invalid API key format - empty account ID".to_string()));
        }
        
        Ok(account_id.to_string())
    }
    
    /// Validate API key format without extracting account ID
    pub fn validate_api_key_format(api_key: &str) -> Result<()> {
        Self::extract_account_id_from_api_key(api_key)?;
        Ok(())
    }
    
    /// Get the authentication header value for HTTP requests
    pub fn get_auth_header(&self) -> (String, String) {
        match self.token_type {
            TokenType::ApiKey => ("x-api-key".to_string(), self.token.clone()),
            TokenType::BearerToken | TokenType::ServiceAccount => {
                ("Authorization".to_string(), format!("Bearer {}", self.token))
            }
        }
    }
}