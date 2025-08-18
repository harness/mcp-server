//! Authentication module for the Harness MCP Server

pub mod jwt;
pub mod session;

use crate::{Error, Result};
use serde::{Deserialize, Serialize};

/// Authentication provider trait
#[async_trait::async_trait]
pub trait Provider: Send + Sync {
    /// Get authentication header
    async fn get_header(&self) -> Result<(String, String)>;
}

/// Principal represents the identity of an acting entity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Principal {
    /// Principal ID
    pub id: u64,
    /// Principal UID
    pub uid: String,
    /// Principal email
    pub email: String,
    /// Principal type (USER, SERVICE_ACCOUNT, etc.)
    pub r#type: String,
    /// Display name
    pub display_name: String,
    /// Account ID (TODO: should not be associated with principal)
    pub account_id: String,
}

/// Session contains information of the authenticated principal
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    /// The authenticated principal
    pub principal: Principal,
}

/// API Key authentication provider
pub struct ApiKeyProvider {
    api_key: String,
}

impl ApiKeyProvider {
    /// Create a new API key provider
    pub fn new(api_key: String) -> Self {
        Self { api_key }
    }
}

#[async_trait::async_trait]
impl Provider for ApiKeyProvider {
    async fn get_header(&self) -> Result<(String, String)> {
        Ok(("x-api-key".to_string(), self.api_key.clone()))
    }
}

/// Authenticate a session using bearer token and MCP secret
pub async fn authenticate_session(
    bearer_token: &str,
    mcp_secret: &str,
) -> Result<Session> {
    // TODO: Implement actual session authentication
    // This would involve validating the bearer token and extracting session information
    
    // For now, return a placeholder session
    Ok(Session {
        principal: Principal {
            id: 0,
            uid: "placeholder".to_string(),
            email: "placeholder@example.com".to_string(),
            r#type: "USER".to_string(),
            display_name: "Placeholder User".to_string(),
            account_id: "placeholder_account".to_string(),
        },
    })
}