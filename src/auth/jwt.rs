//! JWT authentication support

use crate::{auth::Session, Error, Result};
use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use serde::{Deserialize, Serialize};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

/// JWT Claims structure
#[derive(Debug, Serialize, Deserialize)]
pub struct JwtClaims {
    /// Expiration time
    pub exp: u64,
    /// Issued at
    pub iat: u64,
    /// Issuer
    pub iss: Option<String>,
    /// Subject
    pub sub: Option<String>,
    
    /// Common claims
    pub r#type: Option<String>,
    pub name: Option<String>,
    
    /// User-specific claims
    pub email: Option<String>,
    pub username: Option<String>,
    #[serde(rename = "accountId")]
    pub account_id: Option<String>,
}

/// JWT Provider for generating tokens
pub struct JwtProvider {
    secret: String,
    service_identity: String,
    lifetime: Option<Duration>,
}

impl JwtProvider {
    /// Create a new JWT provider
    pub fn new(
        secret: String,
        service_identity: String,
        lifetime: Option<Duration>,
    ) -> Self {
        Self {
            secret,
            service_identity,
            lifetime,
        }
    }

    /// Generate a JWT token for the given session
    pub fn generate_token(&self, session: &Session) -> Result<String> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| Error::Internal(e.into()))?
            .as_secs();

        let exp = now + self.lifetime.unwrap_or(Duration::from_secs(3600)).as_secs();

        let claims = JwtClaims {
            exp,
            iat: now,
            iss: Some(self.service_identity.clone()),
            sub: Some(session.principal.uid.clone()),
            r#type: Some("service".to_string()),
            name: Some(session.principal.uid.clone()),
            email: Some(session.principal.email.clone()),
            username: Some(session.principal.display_name.clone()),
            account_id: Some(session.principal.account_id.clone()),
        };

        let header = Header::new(Algorithm::HS256);
        let encoding_key = EncodingKey::from_secret(self.secret.as_ref());

        encode(&header, &claims, &encoding_key).map_err(Error::from)
    }

    /// Get authorization header for the given session
    pub fn get_header(&self, session: &Session) -> Result<(String, String)> {
        let token = self.generate_token(session)?;
        Ok(("Authorization".to_string(), format!("Bearer {}", token)))
    }
}