use serde::{Deserialize, Serialize};

/// Authentication session containing principal information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthSession {
    pub principal: Principal,
}

/// Principal information for authenticated user
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Principal {
    pub uid: String,
    pub email: Option<String>,
    pub display_name: Option<String>,
    pub account_id: String,
}

impl Principal {
    pub fn new(
        uid: String,
        email: Option<String>,
        display_name: Option<String>,
        account_id: String,
    ) -> Self {
        Self {
            uid,
            email,
            display_name,
            account_id,
        }
    }
}