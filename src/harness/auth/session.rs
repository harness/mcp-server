use anyhow::Result;
use super::{AuthSession, JwtAuthenticator};

pub async fn authenticate_session(bearer_token: &str, mcp_secret: &str) -> Result<AuthSession> {
    // Remove "Bearer " prefix if present
    let token = bearer_token.strip_prefix("Bearer ").unwrap_or(bearer_token);
    
    // Create JWT authenticator with the MCP secret
    let authenticator = JwtAuthenticator::new(mcp_secret.to_string());
    
    // Authenticate the token
    authenticator.authenticate(token).await
}