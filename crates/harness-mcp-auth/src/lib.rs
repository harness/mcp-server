//! Authentication and authorization for Harness MCP Server
//!
//! This crate provides authentication mechanisms including API keys,
//! JWT tokens, and session management for the Harness platform.

pub mod api_key;
pub mod error;
pub mod jwt;
pub mod middleware;
pub mod providers;
pub mod session;

pub use error::{Error, Result};
pub use providers::AuthProvider;

/// Re-export commonly used types
pub mod prelude {
    pub use crate::api_key::*;
    pub use crate::error::{Error, Result};
    pub use crate::jwt::*;
    pub use crate::middleware::*;
    pub use crate::providers::*;
    pub use crate::session::*;
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::providers::{ApiKeyProvider, BearerTokenProvider, JwtProvider};
    use crate::session::{authenticate_session, Principal, Session};
    use std::time::Duration;

    #[test]
    fn test_api_key_provider_creation() {
        let api_key = "pat.test_account.test_token.test_value".to_string();
        let provider = ApiKeyProvider::new(api_key).unwrap();
        assert_eq!(provider.get_account_id(), Some("test_account".to_string()));
    }

    #[test]
    fn test_api_key_provider_invalid_format() {
        let api_key = "invalid_key".to_string();
        let result = ApiKeyProvider::new(api_key);
        assert!(result.is_err());
    }

    #[test]
    fn test_bearer_token_provider() {
        let token = "test_token".to_string();
        let account_id = Some("test_account".to_string());
        let provider = BearerTokenProvider::new(token, account_id.clone());
        assert_eq!(provider.get_account_id(), account_id);
    }

    #[test]
    fn test_jwt_provider() {
        let secret = "test_secret".to_string();
        let service_identity = "Basic".to_string();
        let lifetime = Duration::from_secs(3600);
        
        let provider = JwtProvider::new(secret, service_identity, lifetime);
        assert!(provider.get_account_id().is_none()); // No session set
    }

    #[test]
    fn test_session_creation() {
        let principal = Principal {
            id: Some(123),
            uid: "test_user".to_string(),
            email: "test@example.com".to_string(),
            principal_type: "USER".to_string(),
            display_name: "Test User".to_string(),
            account_id: "test_account".to_string(),
        };
        
        let session = Session::new(principal.clone());
        assert_eq!(session.principal.uid, principal.uid);
        assert_eq!(session.principal.email, principal.email);
    }

    #[tokio::test]
    async fn test_api_key_auth_headers() {
        let api_key = "pat.test_account.test_token.test_value".to_string();
        let provider = ApiKeyProvider::new(api_key.clone()).unwrap();
        
        let mut headers = reqwest::header::HeaderMap::new();
        provider.add_auth_headers(&mut headers).await.unwrap();
        
        assert!(headers.contains_key("x-api-key"));
        assert_eq!(headers.get("x-api-key").unwrap().to_str().unwrap(), "pat.test_account.test_token.test_value");
    }

    #[tokio::test]
    async fn test_bearer_token_auth_headers() {
        let token = "test_token".to_string();
        let provider = BearerTokenProvider::new(token.clone(), None);
        
        let mut headers = reqwest::header::HeaderMap::new();
        provider.add_auth_headers(&mut headers).await.unwrap();
        
        assert!(headers.contains_key("authorization"));
        assert_eq!(headers.get("authorization").unwrap().to_str().unwrap(), "Bearer test_token");
    }
}