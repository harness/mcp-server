use crate::{AuthError, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Authentication session information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthSession {
    pub principal: Principal,
    pub permissions: Vec<String>,
    pub metadata: HashMap<String, String>,
    pub expires_at: Option<i64>,
}

/// Principal information for authenticated user/service
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Principal {
    pub account_id: String,
    pub user_id: Option<String>,
    pub email: Option<String>,
    pub name: Option<String>,
    pub principal_type: PrincipalType,
    pub org_id: Option<String>,
    pub project_id: Option<String>,
}

/// Type of principal (user, service account, etc.)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PrincipalType {
    User,
    ServiceAccount,
    ApiKey,
    Service,
}

impl AuthSession {
    /// Create a new authentication session
    pub fn new(principal: Principal) -> Self {
        Self {
            principal,
            permissions: Vec::new(),
            metadata: HashMap::new(),
            expires_at: None,
        }
    }

    /// Create a session for a user
    pub fn user(
        account_id: String,
        user_id: String,
        email: Option<String>,
        name: Option<String>,
    ) -> Self {
        let principal = Principal {
            account_id,
            user_id: Some(user_id),
            email,
            name,
            principal_type: PrincipalType::User,
            org_id: None,
            project_id: None,
        };
        Self::new(principal)
    }

    /// Create a session for an API key
    pub fn api_key(account_id: String, key_id: String) -> Self {
        let principal = Principal {
            account_id,
            user_id: Some(key_id),
            email: None,
            name: None,
            principal_type: PrincipalType::ApiKey,
            org_id: None,
            project_id: None,
        };
        Self::new(principal)
    }

    /// Create a session for a service
    pub fn service(account_id: String, service_name: String) -> Self {
        let principal = Principal {
            account_id,
            user_id: None,
            email: None,
            name: Some(service_name),
            principal_type: PrincipalType::Service,
            org_id: None,
            project_id: None,
        };
        Self::new(principal)
    }

    /// Add a permission to the session
    pub fn add_permission<S: Into<String>>(mut self, permission: S) -> Self {
        self.permissions.push(permission.into());
        self
    }

    /// Add multiple permissions to the session
    pub fn add_permissions<I, S>(mut self, permissions: I) -> Self
    where
        I: IntoIterator<Item = S>,
        S: Into<String>,
    {
        self.permissions.extend(permissions.into_iter().map(|p| p.into()));
        self
    }

    /// Add metadata to the session
    pub fn add_metadata<K, V>(mut self, key: K, value: V) -> Self
    where
        K: Into<String>,
        V: Into<String>,
    {
        self.metadata.insert(key.into(), value.into());
        self
    }

    /// Set the expiration time
    pub fn expires_at(mut self, timestamp: i64) -> Self {
        self.expires_at = Some(timestamp);
        self
    }

    /// Check if the session has a specific permission
    pub fn has_permission(&self, permission: &str) -> bool {
        self.permissions.contains(&permission.to_string())
    }

    /// Check if the session is expired
    pub fn is_expired(&self) -> bool {
        if let Some(expires_at) = self.expires_at {
            let now = chrono::Utc::now().timestamp();
            now > expires_at
        } else {
            false
        }
    }

    /// Validate the session
    pub fn validate(&self) -> Result<()> {
        if self.is_expired() {
            return Err(AuthError::TokenExpired);
        }

        if self.principal.account_id.is_empty() {
            return Err(AuthError::InvalidCredentials);
        }

        Ok(())
    }

    /// Get the account ID
    pub fn account_id(&self) -> &str {
        &self.principal.account_id
    }

    /// Get the user ID (if available)
    pub fn user_id(&self) -> Option<&str> {
        self.principal.user_id.as_deref()
    }

    /// Get the email (if available)
    pub fn email(&self) -> Option<&str> {
        self.principal.email.as_deref()
    }

    /// Get the name (if available)
    pub fn name(&self) -> Option<&str> {
        self.principal.name.as_deref()
    }

    /// Get the principal type
    pub fn principal_type(&self) -> &PrincipalType {
        &self.principal.principal_type
    }

    /// Check if this is a user session
    pub fn is_user(&self) -> bool {
        matches!(self.principal.principal_type, PrincipalType::User)
    }

    /// Check if this is a service session
    pub fn is_service(&self) -> bool {
        matches!(self.principal.principal_type, PrincipalType::Service)
    }

    /// Check if this is an API key session
    pub fn is_api_key(&self) -> bool {
        matches!(self.principal.principal_type, PrincipalType::ApiKey)
    }
}

impl Principal {
    /// Create a new principal
    pub fn new(
        account_id: String,
        principal_type: PrincipalType,
    ) -> Self {
        Self {
            account_id,
            user_id: None,
            email: None,
            name: None,
            principal_type,
            org_id: None,
            project_id: None,
        }
    }

    /// Set the user ID
    pub fn with_user_id<S: Into<String>>(mut self, user_id: S) -> Self {
        self.user_id = Some(user_id.into());
        self
    }

    /// Set the email
    pub fn with_email<S: Into<String>>(mut self, email: S) -> Self {
        self.email = Some(email.into());
        self
    }

    /// Set the name
    pub fn with_name<S: Into<String>>(mut self, name: S) -> Self {
        self.name = Some(name.into());
        self
    }

    /// Set the organization ID
    pub fn with_org_id<S: Into<String>>(mut self, org_id: S) -> Self {
        self.org_id = Some(org_id.into());
        self
    }

    /// Set the project ID
    pub fn with_project_id<S: Into<String>>(mut self, project_id: S) -> Self {
        self.project_id = Some(project_id.into());
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_auth_session_creation() {
        let session = AuthSession::user(
            "account123".to_string(),
            "user456".to_string(),
            Some("user@example.com".to_string()),
            Some("Test User".to_string()),
        );

        assert_eq!(session.account_id(), "account123");
        assert_eq!(session.user_id(), Some("user456"));
        assert_eq!(session.email(), Some("user@example.com"));
        assert_eq!(session.name(), Some("Test User"));
        assert!(session.is_user());
        assert!(!session.is_service());
    }

    #[test]
    fn test_api_key_session() {
        let session = AuthSession::api_key(
            "account123".to_string(),
            "key456".to_string(),
        );

        assert_eq!(session.account_id(), "account123");
        assert_eq!(session.user_id(), Some("key456"));
        assert!(session.is_api_key());
        assert!(!session.is_user());
    }

    #[test]
    fn test_service_session() {
        let session = AuthSession::service(
            "account123".to_string(),
            "test-service".to_string(),
        );

        assert_eq!(session.account_id(), "account123");
        assert_eq!(session.name(), Some("test-service"));
        assert!(session.is_service());
        assert!(!session.is_user());
    }

    #[test]
    fn test_permissions() {
        let session = AuthSession::user(
            "account123".to_string(),
            "user456".to_string(),
            None,
            None,
        )
        .add_permission("read:pipelines")
        .add_permission("write:pipelines")
        .add_permissions(vec!["read:connectors", "write:connectors"]);

        assert!(session.has_permission("read:pipelines"));
        assert!(session.has_permission("write:pipelines"));
        assert!(session.has_permission("read:connectors"));
        assert!(session.has_permission("write:connectors"));
        assert!(!session.has_permission("admin:account"));
    }

    #[test]
    fn test_metadata() {
        let session = AuthSession::user(
            "account123".to_string(),
            "user456".to_string(),
            None,
            None,
        )
        .add_metadata("source", "api_key")
        .add_metadata("client_version", "1.0.0");

        assert_eq!(session.metadata.get("source"), Some(&"api_key".to_string()));
        assert_eq!(session.metadata.get("client_version"), Some(&"1.0.0".to_string()));
    }

    #[test]
    fn test_expiration() {
        let future_timestamp = chrono::Utc::now().timestamp() + 3600; // 1 hour from now
        let past_timestamp = chrono::Utc::now().timestamp() - 3600; // 1 hour ago

        let valid_session = AuthSession::user(
            "account123".to_string(),
            "user456".to_string(),
            None,
            None,
        )
        .expires_at(future_timestamp);

        let expired_session = AuthSession::user(
            "account123".to_string(),
            "user456".to_string(),
            None,
            None,
        )
        .expires_at(past_timestamp);

        assert!(!valid_session.is_expired());
        assert!(expired_session.is_expired());
    }

    #[test]
    fn test_validation() {
        let valid_session = AuthSession::user(
            "account123".to_string(),
            "user456".to_string(),
            None,
            None,
        );

        let expired_session = AuthSession::user(
            "account123".to_string(),
            "user456".to_string(),
            None,
            None,
        )
        .expires_at(chrono::Utc::now().timestamp() - 3600);

        assert!(valid_session.validate().is_ok());
        assert!(expired_session.validate().is_err());
    }
}