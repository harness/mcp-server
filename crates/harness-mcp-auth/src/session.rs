//! Session management

use crate::error::{Error, Result};
use crate::jwt::{decode_token, is_token_expired, Claims};
use serde::{Deserialize, Serialize};

/// Principal represents the identity of an acting entity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Principal {
    pub id: Option<i64>,
    pub uid: String,
    pub email: String,
    pub principal_type: String,
    pub display_name: String,
    pub account_id: String,
}

/// Session contains information of the authenticated principal
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub principal: Principal,
}

impl Session {
    /// Create a new session with principal
    pub fn new(principal: Principal) -> Self {
        Self { principal }
    }
    
    /// Create session from JWT claims
    pub fn from_claims(claims: Claims) -> Self {
        let principal = Principal {
            id: None,
            uid: claims.sub.clone(),
            email: claims.email.unwrap_or_default(),
            principal_type: claims.token_type.unwrap_or_else(|| "USER".to_string()),
            display_name: claims.username.unwrap_or_else(|| claims.sub),
            account_id: claims.account_id.unwrap_or_default(),
        };
        
        Self::new(principal)
    }
}

/// Authenticate a session from a bearer token
pub fn authenticate_session(bearer_token: &str, secret: &[u8]) -> Result<Session> {
    if bearer_token.is_empty() {
        return Err(Error::AuthenticationFailed("Bearer token is empty".to_string()));
    }

    // Decode and validate the JWT token
    let claims = decode_token(bearer_token, secret)?;
    
    // Check if token is expired
    if is_token_expired(&claims) {
        return Err(Error::TokenExpired);
    }
    
    // Validate required fields
    if claims.sub.is_empty() {
        return Err(Error::AuthenticationFailed("Name is required in token claims".to_string()));
    }
    
    // Create session from claims
    Ok(Session::from_claims(claims))
}