//! API key authentication utilities

use crate::error::{Error, Result};

/// Validate API key format
pub fn validate_api_key(api_key: &str) -> Result<()> {
    if api_key.is_empty() {
        return Err(Error::InvalidApiKey("API key cannot be empty".to_string()));
    }
    
    // Check if it follows the expected format: pat.ACCOUNT_ID.TOKEN_ID.<>
    let parts: Vec<&str> = api_key.split('.').collect();
    if parts.len() < 3 || parts[0] != "pat" {
        return Err(Error::InvalidApiKey(
            "API key must follow format: pat.ACCOUNT_ID.TOKEN_ID.<>".to_string(),
        ));
    }
    
    Ok(())
}

/// Extract account ID from API key
pub fn extract_account_id(api_key: &str) -> Result<String> {
    validate_api_key(api_key)?;
    let parts: Vec<&str> = api_key.split('.').collect();
    Ok(parts[1].to_string())
}