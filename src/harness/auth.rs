use crate::types::HarnessError;
use serde::{Deserialize, Serialize};

/// Authentication session information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthSession {
    pub principal: Principal,
    pub token: String,
}

/// Principal information for authenticated user
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Principal {
    pub account_id: String,
    pub user_id: Option<String>,
    pub email: Option<String>,
}

/// API key authentication
pub struct ApiKeyAuth {
    api_key: String,
    account_id: String,
}

impl ApiKeyAuth {
    /// Create new API key authentication
    pub fn new(api_key: String) -> Result<Self, HarnessError> {
        let account_id = extract_account_id_from_api_key(&api_key)?;
        Ok(Self { api_key, account_id })
    }

    /// Get the API key
    pub fn api_key(&self) -> &str {
        &self.api_key
    }

    /// Get the account ID
    pub fn account_id(&self) -> &str {
        &self.account_id
    }
}

/// JWT token authentication
pub struct JwtAuth {
    token: String,
}

impl JwtAuth {
    /// Create new JWT authentication
    pub fn new(token: String) -> Self {
        Self { token }
    }

    /// Get the JWT token
    pub fn token(&self) -> &str {
        &self.token
    }

    /// Validate and decode the JWT token
    pub fn validate(&self) -> Result<AuthSession, HarnessError> {
        // TODO: Implement JWT validation
        // This would decode the JWT, verify signature, check expiration, etc.
        Err(HarnessError::Auth("JWT validation not implemented".to_string()))
    }
}

/// Extract account ID from Harness API key
/// API key format: pat.ACCOUNT_ID.TOKEN_ID.<>
pub fn extract_account_id_from_api_key(api_key: &str) -> Result<String, HarnessError> {
    let parts: Vec<&str> = api_key.split('.').collect();
    if parts.len() < 2 {
        return Err(HarnessError::Auth("Invalid API key format".to_string()));
    }
    Ok(parts[1].to_string())
}

/// Authenticate a session using bearer token and MCP secret
pub async fn authenticate_session(
    bearer_token: &str,
    _mcp_secret: &str,
) -> Result<AuthSession, HarnessError> {
    // TODO: Implement session authentication
    // This would validate the bearer token against the MCP service
    
    // For now, return a placeholder session
    Ok(AuthSession {
        principal: Principal {
            account_id: "placeholder".to_string(),
            user_id: None,
            email: None,
        },
        token: bearer_token.to_string(),
    })
}