use serde::{Deserialize, Serialize};

/// Principal represents the identity of an acting entity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Principal {
    pub id: Option<i64>,
    pub uid: String,
    pub email: Option<String>,
    pub principal_type: String,
    pub display_name: Option<String>,
    pub account_id: String,
}

/// Session contains information of the authenticated principal
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub principal: Principal,
}

impl Session {
    /// Create a new session with the given principal
    pub fn new(principal: Principal) -> Self {
        Self { principal }
    }

    /// Get the account ID from the session
    pub fn account_id(&self) -> &str {
        &self.principal.account_id
    }

    /// Get the user ID from the session
    pub fn user_id(&self) -> &str {
        &self.principal.uid
    }

    /// Get the display name from the session
    pub fn display_name(&self) -> Option<&str> {
        self.principal.display_name.as_deref()
    }

    /// Get the email from the session
    pub fn email(&self) -> Option<&str> {
        self.principal.email.as_deref()
    }
}