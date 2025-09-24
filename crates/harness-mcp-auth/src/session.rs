//! Session management

use serde::{Deserialize, Serialize};

/// User session information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    /// Account ID
    pub account_id: String,
    /// User ID
    pub user_id: Option<String>,
    /// Organization ID
    pub org_id: Option<String>,
    /// Project ID
    pub project_id: Option<String>,
    /// Session expiration timestamp
    pub expires_at: Option<u64>,
}

impl Session {
    /// Create a new session
    pub fn new(account_id: String) -> Self {
        Self {
            account_id,
            user_id: None,
            org_id: None,
            project_id: None,
            expires_at: None,
        }
    }

    /// Check if the session is expired
    pub fn is_expired(&self) -> bool {
        if let Some(expires_at) = self.expires_at {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs();
            now > expires_at
        } else {
            false
        }
    }
}
