use crate::{AuthError, AuthSession, Principal};
use chrono::{DateTime, Duration, Utc};
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use std::time::SystemTime;

/// JWT Claims structure
/// Migrated from Go auth.JWTClaims struct
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JwtClaims {
    /// Standard claims
    pub iss: Option<String>,    // Issuer
    pub sub: Option<String>,    // Subject
    pub aud: Option<String>,    // Audience
    pub exp: Option<i64>,       // Expiration time
    pub nbf: Option<i64>,       // Not before
    pub iat: Option<i64>,       // Issued at
    pub jti: Option<String>,    // JWT ID

    /// Custom claims
    #[serde(rename = "type")]
    pub token_type: Option<String>,
    pub name: Option<String>,
    pub email: Option<String>,
    #[serde(rename = "username")]
    pub user_name: Option<String>,
    #[serde(rename = "accountId")]
    pub account_id: Option<String>,
}

/// JWT Provider for creating and validating tokens
/// Migrated from Go auth.JWTProvider struct
pub struct JwtProvider {
    secret: String,
    service_identity: String,
    lifetime: Option<Duration>,
}

impl JwtProvider {
    /// Create a new JWT provider
    pub fn new(secret: String, service_identity: String, lifetime: Option<Duration>) -> Self {
        Self {
            secret,
            service_identity,
            lifetime,
        }
    }

    /// Generate JWT token for a session
    pub fn generate_token(&self, session: &AuthSession) -> Result<String, AuthError> {
        let now = Utc::now();
        let lifetime = self.lifetime.unwrap_or(Duration::hours(24));
        let exp = now + lifetime;

        let claims = JwtClaims {
            iss: Some("Harness Inc".to_string()),
            iat: Some(now.timestamp()),
            exp: Some(exp.timestamp()),
            token_type: Some("USER".to_string()),
            name: Some(session.principal.uid.clone()),
            email: session.principal.email.clone(),
            user_name: session.principal.display_name.clone(),
            account_id: Some(session.principal.account_id.clone()),
            sub: None,
            aud: None,
            nbf: None,
            jti: None,
        };

        let header = Header::new(Algorithm::HS256);
        let encoding_key = EncodingKey::from_secret(self.secret.as_bytes());

        encode(&header, &claims, &encoding_key)
            .map_err(|e| AuthError::JwtError(e))
    }

    /// Validate and decode JWT token
    pub fn validate_token(&self, token: &str) -> Result<JwtClaims, AuthError> {
        let decoding_key = DecodingKey::from_secret(self.secret.as_bytes());
        let validation = Validation::new(Algorithm::HS256);

        let token_data = decode::<JwtClaims>(token, &decoding_key, &validation)
            .map_err(|e| AuthError::JwtError(e))?;

        Ok(token_data.claims)
    }

    /// Get authorization header value
    pub fn get_auth_header(&self, session: &AuthSession) -> Result<(String, String), AuthError> {
        let token = self.generate_token(session)?;
        let header_value = format!("{} {}", self.service_identity, token);
        Ok(("Authorization".to_string(), header_value))
    }
}

/// Authenticate session from bearer token
pub fn authenticate_session(bearer_token: &str, secret: &str) -> Result<AuthSession, AuthError> {
    if bearer_token.is_empty() {
        return Err(AuthError::AuthenticationFailed("Bearer token is empty".to_string()));
    }

    let provider = JwtProvider::new(secret.to_string(), "Bearer".to_string(), None);
    let claims = provider.validate_token(bearer_token)?;

    // Validate required fields
    if claims.token_type.as_deref() != Some("USER") {
        return Err(AuthError::AuthenticationFailed(
            format!("Invalid token type: expected USER, got {:?}", claims.token_type)
        ));
    }

    let name = claims.name.ok_or_else(|| {
        AuthError::AuthenticationFailed("Name is required in token claims".to_string())
    })?;

    let account_id = claims.account_id.ok_or_else(|| {
        AuthError::AuthenticationFailed("Account ID is required in token claims".to_string())
    })?;

    // Create principal from claims
    let principal = Principal {
        id: None,
        uid: name,
        email: claims.email,
        principal_type: claims.token_type.unwrap_or_else(|| "USER".to_string()),
        display_name: claims.user_name,
        account_id,
        org_id: None,
        project_id: None,
    };

    // Check if token is expired
    let expires_at = claims.exp.map(|exp| {
        DateTime::from_timestamp(exp, 0)
            .unwrap_or_else(|| Utc::now())
    });

    Ok(AuthSession {
        principal,
        token: bearer_token.to_string(),
        expires_at,
    })
}