use crate::error::{authentication_error, HarnessError, Result};
use async_trait::async_trait;
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub mod middleware;
pub mod providers;

pub use middleware::*;
pub use providers::*;

// Re-export for convenience
pub use middleware::auth_middleware;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthSession {
    pub principal: Principal,
    pub account_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Principal {
    pub user_id: String,
    pub email: String,
    pub username: String,
    pub account_id: String,
    pub principal_type: PrincipalType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PrincipalType {
    #[serde(rename = "USER")]
    User,
    #[serde(rename = "SERVICE")]
    Service,
    #[serde(rename = "API_KEY")]
    ApiKey,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JwtClaims {
    pub iss: String,
    pub iat: i64,
    pub exp: i64,
    #[serde(rename = "type")]
    pub principal_type: String,
    pub name: String,
    pub email: String,
    pub username: String,
    #[serde(rename = "accountId")]
    pub account_id: String,
}

#[async_trait]
pub trait AuthProvider: Send + Sync {
    async fn authenticate(&self, token: &str) -> Result<AuthSession>;
    fn get_auth_header(&self, session: &AuthSession) -> Result<(String, String)>;
}

pub struct ApiKeyProvider {
    pub base_url: String,
}

impl ApiKeyProvider {
    pub fn new(base_url: String) -> Self {
        Self { base_url }
    }
    
    fn parse_api_key(&self, api_key: &str) -> Result<(String, String, String)> {
        let parts: Vec<&str> = api_key.split('.').collect();
        if parts.len() != 3 || parts[0] != "pat" {
            return Err(authentication_error("Invalid API key format"));
        }
        
        Ok((
            parts[1].to_string(), // account_id
            parts[2].to_string(), // token_id
            api_key.to_string(),  // full token
        ))
    }
}

#[async_trait]
impl AuthProvider for ApiKeyProvider {
    async fn authenticate(&self, api_key: &str) -> Result<AuthSession> {
        let (account_id, _token_id, _full_token) = self.parse_api_key(api_key)?;
        
        // In a real implementation, you would validate the API key with Harness
        // For now, we'll create a session based on the account ID
        let principal = Principal {
            user_id: "api_key_user".to_string(),
            email: "api@harness.io".to_string(),
            username: "API Key User".to_string(),
            account_id: account_id.clone(),
            principal_type: PrincipalType::ApiKey,
        };
        
        Ok(AuthSession {
            principal,
            account_id,
        })
    }
    
    fn get_auth_header(&self, _session: &AuthSession) -> Result<(String, String)> {
        // For API key auth, we don't need to generate headers for outbound requests
        // The API key is used directly
        Ok(("x-api-key".to_string(), "".to_string()))
    }
}

pub struct JwtProvider {
    pub secret: String,
}

impl JwtProvider {
    pub fn new(secret: String) -> Self {
        Self { secret }
    }
    
    pub fn generate_token(&self, session: &AuthSession) -> Result<String> {
        let now = Utc::now().timestamp();
        let claims = JwtClaims {
            iss: "Harness Inc".to_string(),
            iat: now,
            exp: now + 3600, // 1 hour
            principal_type: match session.principal.principal_type {
                PrincipalType::User => "USER".to_string(),
                PrincipalType::Service => "SERVICE".to_string(),
                PrincipalType::ApiKey => "API_KEY".to_string(),
            },
            name: session.principal.user_id.clone(),
            email: session.principal.email.clone(),
            username: session.principal.username.clone(),
            account_id: session.account_id.clone(),
        };
        
        let header = Header::new(Algorithm::HS256);
        let encoding_key = EncodingKey::from_secret(self.secret.as_ref());
        
        encode(&header, &claims, &encoding_key).map_err(HarnessError::from)
    }
}

#[async_trait]
impl AuthProvider for JwtProvider {
    async fn authenticate(&self, token: &str) -> Result<AuthSession> {
        let decoding_key = DecodingKey::from_secret(self.secret.as_ref());
        let validation = Validation::new(Algorithm::HS256);
        
        let token_data = decode::<JwtClaims>(token, &decoding_key, &validation)?;
        let claims = token_data.claims;
        
        let principal_type = match claims.principal_type.as_str() {
            "USER" => PrincipalType::User,
            "SERVICE" => PrincipalType::Service,
            "API_KEY" => PrincipalType::ApiKey,
            _ => PrincipalType::User,
        };
        
        let principal = Principal {
            user_id: claims.name,
            email: claims.email,
            username: claims.username,
            account_id: claims.account_id.clone(),
            principal_type,
        };
        
        Ok(AuthSession {
            principal,
            account_id: claims.account_id,
        })
    }
    
    fn get_auth_header(&self, session: &AuthSession) -> Result<(String, String)> {
        let token = self.generate_token(session)?;
        Ok(("Authorization".to_string(), format!("Bearer {}", token)))
    }
}