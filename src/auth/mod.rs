pub mod api_key;
pub mod jwt;
pub mod session;

use crate::error::Result;

pub use api_key::*;
pub use jwt::*;
pub use session::*;

/// Extract account ID from Harness API key
/// API key format: pat.ACCOUNT_ID.TOKEN_ID.<>
pub fn extract_account_id_from_api_key(api_key: &str) -> Result<String> {
    let parts: Vec<&str> = api_key.split('.').collect();
    if parts.len() < 2 {
        return Err(crate::error::HarnessError::auth_error("Invalid API key format"));
    }
    Ok(parts[1].to_string())
}