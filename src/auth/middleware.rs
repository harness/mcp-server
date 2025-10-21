use crate::auth::AuthSession;
use crate::error::HarnessError;
use axum::{
    extract::{Request, State},
    http::{HeaderMap, StatusCode},
    middleware::Next,
    response::Response,
};
use std::sync::Arc;
use tracing::{debug, warn};

/// Authentication middleware for HTTP requests
pub async fn auth_middleware(
    headers: HeaderMap,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Extract authentication information from headers
    let auth_session = match extract_auth_from_headers(&headers).await {
        Ok(session) => session,
        Err(e) => {
            warn!("Authentication failed: {}", e);
            return Err(StatusCode::UNAUTHORIZED);
        }
    };
    
    // Check if session is expired
    if auth_session.is_expired() {
        warn!("Session expired for account: {}", auth_session.principal.account_id);
        return Err(StatusCode::UNAUTHORIZED);
    }
    
    debug!("Authenticated request for account: {}", auth_session.principal.account_id);
    
    // Add the session to request extensions for use in handlers
    request.extensions_mut().insert(Arc::new(auth_session));
    
    Ok(next.run(request).await)
}

/// Extract authentication session from HTTP headers
async fn extract_auth_from_headers(headers: &HeaderMap) -> Result<AuthSession, HarnessError> {
    // Try API key first (x-api-key header)
    if let Some(api_key) = headers.get("x-api-key") {
        let api_key_str = api_key.to_str()
            .map_err(|_| HarnessError::Auth("Invalid API key header format".to_string()))?;
        
        return AuthSession::from_api_key(api_key_str);
    }
    
    // Try Bearer token (Authorization header)
    if let Some(auth_header) = headers.get("authorization") {
        let auth_str = auth_header.to_str()
            .map_err(|_| HarnessError::Auth("Invalid authorization header format".to_string()))?;
        
        if auth_str.starts_with("Bearer ") {
            let token = auth_str.strip_prefix("Bearer ").unwrap();
            
            // For Bearer tokens, we need the MCP secret to validate
            // In a real implementation, this would come from configuration
            // For now, we'll create a session without full validation
            return create_bearer_session(token);
        }
    }
    
    Err(HarnessError::Auth("No valid authentication found in headers".to_string()))
}

/// Create a session from a bearer token (simplified for demo)
fn create_bearer_session(token: &str) -> Result<AuthSession, HarnessError> {
    // In a real implementation, this would validate the JWT token
    // For now, we'll create a basic session
    use crate::auth::{Principal, TokenType, UserType};
    use std::collections::HashMap;
    
    let principal = Principal {
        account_id: "demo_account".to_string(),
        user_id: Some("demo_user".to_string()),
        email: None,
        name: None,
        user_type: Some(UserType::User),
        default_account_id: Some("demo_account".to_string()),
    };
    
    Ok(AuthSession {
        principal,
        token: token.to_string(),
        token_type: TokenType::BearerToken,
        expires_at: None,
        scopes: vec!["*".to_string()],
        permissions: HashMap::new(),
    })
}

/// Extract authenticated session from request extensions
pub fn get_auth_session(request: &Request) -> Option<Arc<AuthSession>> {
    request.extensions().get::<Arc<AuthSession>>().cloned()
}

/// Require authentication and return the session
pub fn require_auth_session(request: &Request) -> Result<Arc<AuthSession>, HarnessError> {
    get_auth_session(request)
        .ok_or_else(|| HarnessError::Auth("Authentication required".to_string()))
}

/// Check if the authenticated user has permission for a specific action
pub fn check_permission(
    session: &AuthSession,
    resource: &str,
    action: &str,
) -> Result<(), HarnessError> {
    if session.has_permission(resource, action) {
        Ok(())
    } else {
        Err(HarnessError::Auth(format!(
            "Insufficient permissions for {} on {}",
            action, resource
        )))
    }
}

/// Check if the authenticated user has a specific scope
pub fn check_scope(session: &AuthSession, scope: &str) -> Result<(), HarnessError> {
    if session.has_scope(scope) {
        Ok(())
    } else {
        Err(HarnessError::Auth(format!(
            "Missing required scope: {}",
            scope
        )))
    }
}