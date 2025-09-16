use crate::{AuthError, Result, AuthSession, Principal, PrincipalType};
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// JWT claims for Harness authentication
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JwtClaims {
    /// Subject (user ID or service name)
    pub sub: String,
    
    /// Account ID
    pub account_id: String,
    
    /// Organization ID (optional)
    pub org_id: Option<String>,
    
    /// Project ID (optional)
    pub project_id: Option<String>,
    
    /// Email (for user tokens)
    pub email: Option<String>,
    
    /// Name (user name or service name)
    pub name: Option<String>,
    
    /// Principal type
    pub principal_type: String,
    
    /// Permissions
    pub permissions: Vec<String>,
    
    /// Issued at timestamp
    pub iat: i64,
    
    /// Expiration timestamp
    pub exp: i64,
    
    /// Issuer
    pub iss: String,
    
    /// Audience
    pub aud: String,
    
    /// Additional metadata
    #[serde(flatten)]
    pub metadata: HashMap<String, serde_json::Value>,
}

/// JWT validator for validating and parsing JWT tokens
pub struct JwtValidator {
    decoding_key: DecodingKey,
    validation: Validation,
}

impl JwtValidator {
    /// Create a new JWT validator with a secret key
    pub fn new(secret: &[u8]) -> Self {
        let decoding_key = DecodingKey::from_secret(secret);
        let mut validation = Validation::new(Algorithm::HS256);
        validation.set_audience(&["harness-mcp"]);
        validation.set_issuer(&["harness"]);
        
        Self {
            decoding_key,
            validation,
        }
    }

    /// Create a new JWT validator with RSA public key
    pub fn new_rsa(public_key: &[u8]) -> Result<Self> {
        let decoding_key = DecodingKey::from_rsa_pem(public_key)
            .map_err(|e| AuthError::Jwt(e))?;
        
        let mut validation = Validation::new(Algorithm::RS256);
        validation.set_audience(&["harness-mcp"]);
        validation.set_issuer(&["harness"]);
        
        Ok(Self {
            decoding_key,
            validation,
        })
    }

    /// Validate and decode a JWT token
    pub fn validate_token(&self, token: &str) -> Result<JwtClaims> {
        let token_data = decode::<JwtClaims>(token, &self.decoding_key, &self.validation)
            .map_err(|e| AuthError::Jwt(e))?;
        
        Ok(token_data.claims)
    }

    /// Convert JWT claims to an authentication session
    pub fn claims_to_session(&self, claims: JwtClaims) -> Result<AuthSession> {
        let principal_type = match claims.principal_type.as_str() {
            "user" => PrincipalType::User,
            "service_account" => PrincipalType::ServiceAccount,
            "api_key" => PrincipalType::ApiKey,
            "service" => PrincipalType::Service,
            _ => return Err(AuthError::InvalidTokenFormat),
        };

        let principal = Principal {
            account_id: claims.account_id,
            user_id: Some(claims.sub),
            email: claims.email,
            name: claims.name,
            principal_type,
            org_id: claims.org_id,
            project_id: claims.project_id,
        };

        let mut metadata = HashMap::new();
        for (key, value) in claims.metadata {
            if let Some(string_value) = value.as_str() {
                metadata.insert(key, string_value.to_string());
            } else {
                metadata.insert(key, value.to_string());
            }
        }

        let session = AuthSession {
            principal,
            permissions: claims.permissions,
            metadata,
            expires_at: Some(claims.exp),
        };

        session.validate()?;
        Ok(session)
    }

    /// Validate a token and return an authentication session
    pub fn validate_and_create_session(&self, token: &str) -> Result<AuthSession> {
        let claims = self.validate_token(token)?;
        self.claims_to_session(claims)
    }
}

/// JWT encoder for creating JWT tokens
pub struct JwtEncoder {
    encoding_key: EncodingKey,
    header: Header,
}

impl JwtEncoder {
    /// Create a new JWT encoder with a secret key
    pub fn new(secret: &[u8]) -> Self {
        let encoding_key = EncodingKey::from_secret(secret);
        let header = Header::new(Algorithm::HS256);
        
        Self {
            encoding_key,
            header,
        }
    }

    /// Create a new JWT encoder with RSA private key
    pub fn new_rsa(private_key: &[u8]) -> Result<Self> {
        let encoding_key = EncodingKey::from_rsa_pem(private_key)
            .map_err(|e| AuthError::Jwt(e))?;
        let header = Header::new(Algorithm::RS256);
        
        Ok(Self {
            encoding_key,
            header,
        })
    }

    /// Create a JWT token from an authentication session
    pub fn create_token(&self, session: &AuthSession, expires_in_seconds: i64) -> Result<String> {
        let now = chrono::Utc::now().timestamp();
        let exp = now + expires_in_seconds;

        let principal_type = match session.principal.principal_type {
            PrincipalType::User => "user",
            PrincipalType::ServiceAccount => "service_account",
            PrincipalType::ApiKey => "api_key",
            PrincipalType::Service => "service",
        };

        let mut metadata = HashMap::new();
        for (key, value) in &session.metadata {
            metadata.insert(key.clone(), serde_json::Value::String(value.clone()));
        }

        let claims = JwtClaims {
            sub: session.principal.user_id.clone().unwrap_or_else(|| "unknown".to_string()),
            account_id: session.principal.account_id.clone(),
            org_id: session.principal.org_id.clone(),
            project_id: session.principal.project_id.clone(),
            email: session.principal.email.clone(),
            name: session.principal.name.clone(),
            principal_type: principal_type.to_string(),
            permissions: session.permissions.clone(),
            iat: now,
            exp,
            iss: "harness".to_string(),
            aud: "harness-mcp".to_string(),
            metadata,
        };

        encode(&self.header, &claims, &self.encoding_key)
            .map_err(|e| AuthError::Jwt(e))
    }

    /// Create a JWT token from claims
    pub fn create_token_from_claims(&self, claims: &JwtClaims) -> Result<String> {
        encode(&self.header, claims, &self.encoding_key)
            .map_err(|e| AuthError::Jwt(e))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_SECRET: &[u8] = b"test_secret_key_for_jwt_testing";

    #[test]
    fn test_jwt_encode_decode() {
        let encoder = JwtEncoder::new(TEST_SECRET);
        let validator = JwtValidator::new(TEST_SECRET);

        let session = AuthSession::user(
            "account123".to_string(),
            "user456".to_string(),
            Some("user@example.com".to_string()),
            Some("Test User".to_string()),
        )
        .add_permission("read:pipelines")
        .add_permission("write:pipelines")
        .add_metadata("client", "mcp-server");

        let token = encoder.create_token(&session, 3600).unwrap();
        assert!(!token.is_empty());

        let decoded_session = validator.validate_and_create_session(&token).unwrap();
        assert_eq!(decoded_session.account_id(), "account123");
        assert_eq!(decoded_session.user_id(), Some("user456"));
        assert_eq!(decoded_session.email(), Some("user@example.com"));
        assert_eq!(decoded_session.name(), Some("Test User"));
        assert!(decoded_session.has_permission("read:pipelines"));
        assert!(decoded_session.has_permission("write:pipelines"));
        assert_eq!(decoded_session.metadata.get("client"), Some(&"mcp-server".to_string()));
    }

    #[test]
    fn test_jwt_claims_validation() {
        let validator = JwtValidator::new(TEST_SECRET);

        let now = chrono::Utc::now().timestamp();
        let claims = JwtClaims {
            sub: "user123".to_string(),
            account_id: "account456".to_string(),
            org_id: None,
            project_id: None,
            email: Some("user@example.com".to_string()),
            name: Some("Test User".to_string()),
            principal_type: "user".to_string(),
            permissions: vec!["read:pipelines".to_string()],
            iat: now,
            exp: now + 3600,
            iss: "harness".to_string(),
            aud: "harness-mcp".to_string(),
            metadata: HashMap::new(),
        };

        let session = validator.claims_to_session(claims).unwrap();
        assert_eq!(session.account_id(), "account456");
        assert_eq!(session.user_id(), Some("user123"));
        assert!(session.is_user());
    }

    #[test]
    fn test_expired_token() {
        let encoder = JwtEncoder::new(TEST_SECRET);
        let validator = JwtValidator::new(TEST_SECRET);

        let session = AuthSession::user(
            "account123".to_string(),
            "user456".to_string(),
            None,
            None,
        );

        // Create a token that expires immediately
        let token = encoder.create_token(&session, -1).unwrap();
        
        // Validation should fail due to expiration
        let result = validator.validate_and_create_session(&token);
        assert!(result.is_err());
    }

    #[test]
    fn test_invalid_token_format() {
        let validator = JwtValidator::new(TEST_SECRET);
        
        let result = validator.validate_token("invalid.token.format");
        assert!(result.is_err());
    }

    #[test]
    fn test_service_token() {
        let encoder = JwtEncoder::new(TEST_SECRET);
        let validator = JwtValidator::new(TEST_SECRET);

        let session = AuthSession::service(
            "account123".to_string(),
            "test-service".to_string(),
        )
        .add_permission("admin:account");

        let token = encoder.create_token(&session, 3600).unwrap();
        let decoded_session = validator.validate_and_create_session(&token).unwrap();
        
        assert_eq!(decoded_session.account_id(), "account123");
        assert_eq!(decoded_session.name(), Some("test-service"));
        assert!(decoded_session.is_service());
        assert!(decoded_session.has_permission("admin:account"));
    }
}