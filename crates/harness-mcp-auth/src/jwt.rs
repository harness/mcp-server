//! JWT token handling

use crate::error::{Error, Result};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation, Algorithm};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH, Duration};

/// JWT claims structure matching Go implementation
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    // Standard claims
    pub iss: Option<String>,
    pub sub: String,
    pub exp: usize,
    pub iat: usize,
    
    // Custom claims
    #[serde(rename = "type")]
    pub token_type: Option<String>,
    pub name: Option<String>,
    pub email: Option<String>,
    pub username: Option<String>,
    #[serde(rename = "accountId")]
    pub account_id: Option<String>,
}

impl Claims {
    /// Create new claims for a user
    pub fn new_user_claims(
        name: String,
        email: String,
        username: String,
        account_id: String,
        lifetime: Duration,
    ) -> Result<Self> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| Error::Generic(format!("System time error: {}", e)))?;

        let issued_at = now.as_secs() as usize;
        let expires_at = (now + lifetime).as_secs() as usize;

        Ok(Claims {
            iss: Some("Harness Inc".to_string()),
            sub: name.clone(),
            exp: expires_at,
            iat: issued_at,
            token_type: Some("USER".to_string()),
            name: Some(name),
            email: Some(email),
            username: Some(username),
            account_id: Some(account_id),
        })
    }
}

/// Encode a JWT token
pub fn encode_token(claims: &Claims, secret: &[u8]) -> Result<String> {
    let header = Header::new(Algorithm::HS256);
    let token = encode(&header, claims, &EncodingKey::from_secret(secret))?;
    Ok(token)
}

/// Decode and validate a JWT token
pub fn decode_token(token: &str, secret: &[u8]) -> Result<Claims> {
    let validation = Validation::new(Algorithm::HS256);
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret),
        &validation,
    )?;
    
    Ok(token_data.claims)
}

/// Check if a token is expired
pub fn is_token_expired(claims: &Claims) -> bool {
    let now = chrono::Utc::now().timestamp() as usize;
    claims.exp < now
}