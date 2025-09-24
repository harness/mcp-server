//! JWT authentication

use harness_mcp_core::Result;
use serde::{Deserialize, Serialize};

/// JWT authentication handler
pub struct JwtAuth {
    // TODO: Add fields for JWT validation
}

/// JWT claims structure
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
    pub iat: usize,
    pub account_id: String,
    pub user_id: Option<String>,
}

impl JwtAuth {
    /// Create a new JWT auth handler
    pub fn new() -> Self {
        Self {}
    }

    /// Validate a JWT token
    pub fn validate_token(&self, _token: &str) -> Result<Claims> {
        // TODO: Implement JWT validation
        Ok(Claims {
            sub: "user".to_string(),
            exp: 0,
            iat: 0,
            account_id: "account".to_string(),
            user_id: Some("user".to_string()),
        })
    }
}

impl Default for JwtAuth {
    fn default() -> Self {
        Self::new()
    }
}
