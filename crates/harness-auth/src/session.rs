use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Authentication session
/// Migrated from Go auth.Session struct
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthSession {
    pub principal: Principal,
    pub token: String,
    pub expires_at: Option<DateTime<Utc>>,
}

/// Principal information representing the identity of an acting entity
/// Migrated from Go auth.Principal struct
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Principal {
    /// Unique identifier
    pub id: Option<i64>,
    /// User ID (UID in Go version)
    pub uid: String,
    /// Email address
    pub email: Option<String>,
    /// Principal type (e.g., "USER")
    pub principal_type: String,
    /// Display name
    pub display_name: Option<String>,
    /// Account ID
    pub account_id: String,
    /// Organization ID (optional)
    pub org_id: Option<String>,
    /// Project ID (optional)
    pub project_id: Option<String>,
}

impl AuthSession {
    /// Check if the session is expired
    pub fn is_expired(&self) -> bool {
        if let Some(expires_at) = self.expires_at {
            Utc::now() > expires_at
        } else {
            false
        }
    }
    
    /// Get the account ID
    pub fn account_id(&self) -> &str {
        &self.principal.account_id
    }
    
    /// Get the organization ID
    pub fn org_id(&self) -> Option<&str> {
        self.principal.org_id.as_deref()
    }
    
    /// Get the project ID
    pub fn project_id(&self) -> Option<&str> {
        self.principal.project_id.as_deref()
    }
}