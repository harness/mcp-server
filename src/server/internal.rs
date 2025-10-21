use crate::config::Config;
use crate::error::Result;
use crate::auth::AuthSession;
use crate::server::stdio;
use tracing::{info, error};

pub async fn run(mut config: Config) -> Result<()> {
    info!("Starting internal MCP server");
    
    // Authenticate the session
    let bearer_token = config.bearer_token.as_ref()
        .ok_or_else(|| crate::error::HarnessError::Auth("Bearer token not provided".to_string()))?;
    
    let mcp_secret = config.mcp_svc_secret.as_ref()
        .ok_or_else(|| crate::error::HarnessError::Auth("MCP service secret not provided".to_string()))?;
    
    let session = AuthSession::authenticate(bearer_token, mcp_secret).await?;
    
    // Set the account ID from the authenticated session
    config.account_id = Some(session.principal.account_id.clone());
    
    info!("Authenticated session for account: {}", session.principal.account_id);
    
    // Run the stdio server with internal configuration
    stdio::run(config).await
}