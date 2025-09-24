//! API key authentication

use harness_mcp_core::Result;

/// API key authentication handler
pub struct ApiKeyAuth {
    // TODO: Add fields for API key validation
}

impl ApiKeyAuth {
    /// Create a new API key auth handler
    pub fn new() -> Self {
        Self {}
    }

    /// Validate an API key
    pub fn validate_api_key(&self, _api_key: &str) -> Result<bool> {
        // TODO: Implement API key validation
        Ok(true)
    }

    /// Extract account ID from API key
    pub fn extract_account_id(&self, api_key: &str) -> Result<String> {
        let parts: Vec<&str> = api_key.split('.').collect();
        if parts.len() < 2 {
            return Err(harness_mcp_core::Error::auth("Invalid API key format"));
        }
        Ok(parts[1].to_string())
    }
}

impl Default for ApiKeyAuth {
    fn default() -> Self {
        Self::new()
    }
}
