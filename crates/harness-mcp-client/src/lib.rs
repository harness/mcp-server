//! HTTP client library for Harness APIs
//!
//! This crate provides HTTP client implementations for interacting with
//! various Harness services through their REST APIs.

pub mod client;
pub mod dto;
pub mod error;
pub mod services;

pub use client::Client;
pub use error::{Error, Result};

/// Re-export commonly used types
pub mod prelude {
    pub use crate::client::*;
    pub use crate::dto::*;
    pub use crate::error::{Error, Result};
    pub use crate::services::*;
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dto::{Scope, PaginationOptions};
    use harness_mcp_auth::providers::ApiKeyProvider;
    use std::sync::Arc;
    use url::Url;

    #[test]
    fn test_scope_creation() {
        let scope = Scope {
            account_id: "test_account".to_string(),
            org_id: Some("test_org".to_string()),
            project_id: Some("test_project".to_string()),
        };
        
        assert_eq!(scope.account_id, "test_account");
        assert_eq!(scope.org_id, Some("test_org".to_string()));
        assert_eq!(scope.project_id, Some("test_project".to_string()));
    }

    #[test]
    fn test_pagination_options() {
        let pagination = PaginationOptions {
            page: Some(1),
            size: Some(20),
        };
        
        assert_eq!(pagination.page, Some(1));
        assert_eq!(pagination.size, Some(20));
    }

    #[test]
    fn test_client_creation() {
        let base_url = Url::parse("https://app.harness.io").unwrap();
        let auth_provider = Arc::new(
            ApiKeyProvider::new("pat.test_account.test_token.test_value".to_string()).unwrap()
        );
        
        let client = Client::new(base_url, auth_provider, None);
        assert!(client.is_ok());
    }

    #[test]
    fn test_scope_serialization() {
        let scope = Scope {
            account_id: "test_account".to_string(),
            org_id: Some("test_org".to_string()),
            project_id: Some("test_project".to_string()),
        };
        
        let serialized = serde_json::to_string(&scope).unwrap();
        let deserialized: Scope = serde_json::from_str(&serialized).unwrap();
        
        assert_eq!(scope.account_id, deserialized.account_id);
        assert_eq!(scope.org_id, deserialized.org_id);
        assert_eq!(scope.project_id, deserialized.project_id);
    }

    #[test]
    fn test_pagination_serialization() {
        let pagination = PaginationOptions {
            page: Some(1),
            size: Some(20),
        };
        
        let serialized = serde_json::to_string(&pagination).unwrap();
        let deserialized: PaginationOptions = serde_json::from_str(&serialized).unwrap();
        
        assert_eq!(pagination.page, deserialized.page);
        assert_eq!(pagination.size, deserialized.size);
    }
}