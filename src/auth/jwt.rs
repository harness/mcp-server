use super::{AuthProvider, AuthSession, JwtClaims};
use anyhow::{Context, Result};
use async_trait::async_trait;
use chrono::Duration;
use jsonwebtoken::{encode, EncodingKey, Header};

const JWT_HEADER_NAME: &str = "Authorization";

/// JWT authentication provider
#[derive(Debug, Clone)]
pub struct JwtProvider {
    secret: String,
    service_identity: String,
    lifetime: Duration,
}

impl JwtProvider {
    pub fn new(secret: String, service_identity: String, lifetime: Duration) -> Self {
        Self {
            secret,
            service_identity,
            lifetime,
        }
    }
}

#[async_trait]
impl AuthProvider for JwtProvider {
    async fn get_header(&self) -> Result<(String, String)> {
        // In a real implementation, we would get the session from context
        // For now, we'll return an error indicating session is required
        Err(anyhow::anyhow!("JWT provider requires auth session in context"))
    }
}

impl JwtProvider {
    /// Generate JWT token for a given session
    pub fn generate_token(&self, session: &AuthSession) -> Result<String> {
        let claims = JwtClaims::new(&session.principal, &self.service_identity, self.lifetime);
        
        let header = Header::default();
        let encoding_key = EncodingKey::from_secret(self.secret.as_ref());
        
        let token = encode(&header, &claims, &encoding_key)
            .context("Failed to encode JWT token")?;
        
        Ok(format!("{} {}", self.service_identity, token))
    }
}