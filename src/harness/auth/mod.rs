pub mod jwt;
pub mod session;

use anyhow::Result;

pub use jwt::JwtValidator;
pub use session::{AuthSession, Principal, authenticate_session};

pub fn extract_account_id_from_api_key(api_key: &str) -> Result<String> {
    let parts: Vec<&str> = api_key.split('.').collect();
    if parts.len() < 2 {
        anyhow::bail!("Invalid API key format");
    }
    Ok(parts[1].to_string())
}