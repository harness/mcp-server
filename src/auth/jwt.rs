use crate::auth::session::{Principal, Session};
use crate::error::{HarnessError, Result};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};

/// JWT claims structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JwtClaims {
    // Standard claims
    pub iss: String,
    pub iat: i64,
    pub exp: i64,
    
    // Custom claims
    #[serde(rename = "type")]
    pub claim_type: String,
    pub name: String,
    pub email: Option<String>,
    pub username: Option<String>,
    #[serde(rename = "accountId")]
    pub account_id: String,
}

/// JWT provider for creating and validating tokens
pub struct JwtProvider {
    secret: String,
    service_identity: String,
    lifetime: Duration,
}

impl JwtProvider {
    /// Create a new JWT provider
    pub fn new(secret: String, service_identity: String, lifetime: Duration) -> Self {
        Self {
            secret,
            service_identity,
            lifetime,
        }
    }

    /// Generate a JWT token for the given session
    pub fn generate_token(&self, session: &Session) -> Result<String> {
        let now = Utc::now();
        let exp = now + self.lifetime;

        let claims = JwtClaims {
            iss: "Harness Inc".to_string(),
            iat: now.timestamp(),
            exp: exp.timestamp(),
            claim_type: "USER".to_string(),
            name: session.principal.uid.clone(),
            email: session.principal.email.clone(),
            username: session.principal.display_name.clone(),
            account_id: session.principal.account_id.clone(),
        };

        let header = Header::new(Algorithm::HS256);
        let encoding_key = EncodingKey::from_secret(self.secret.as_ref());

        encode(&header, &claims, &encoding_key)
            .map_err(HarnessError::Jwt)
    }

    /// Validate and decode a JWT token
    pub fn validate_token(&self, token: &str) -> Result<JwtClaims> {
        let decoding_key = DecodingKey::from_secret(self.secret.as_ref());
        let validation = Validation::new(Algorithm::HS256);

        let token_data = decode::<JwtClaims>(token, &decoding_key, &validation)
            .map_err(HarnessError::Jwt)?;

        Ok(token_data.claims)
    }

    /// Create a session from JWT claims
    pub fn claims_to_session(&self, claims: &JwtClaims) -> Result<Session> {
        if claims.claim_type != "USER" {
            return Err(HarnessError::auth(format!(
                "Invalid token type: expected USER, got {}",
                claims.claim_type
            )));
        }

        if claims.name.is_empty() {
            return Err(HarnessError::auth("Name is required in token claims"));
        }

        let principal = Principal {
            id: None,
            uid: claims.name.clone(),
            email: claims.email.clone(),
            principal_type: claims.claim_type.clone(),
            display_name: claims.username.clone(),
            account_id: claims.account_id.clone(),
        };

        Ok(Session::new(principal))
    }

    /// Authenticate a bearer token and return a session
    pub fn authenticate_session(&self, bearer_token: &str) -> Result<Session> {
        if bearer_token.is_empty() {
            return Err(HarnessError::auth("Bearer token is empty"));
        }

        let claims = self.validate_token(bearer_token)?;
        self.claims_to_session(&claims)
    }

    /// Get authorization header value
    pub fn get_auth_header(&self, session: &Session) -> Result<String> {
        let token = self.generate_token(session)?;
        Ok(format!("{} {}", self.service_identity, token))
    }
}