//! Authentication middleware for HTTP and STDIO

use crate::{
    auth::{AuthProvider, ApiKeyAuth, BearerTokenAuth, JwtAuth, AuthSession, Principal, PrincipalType, AuthContext},
    config::Config,
    error::{ServerError, Result},
};
use axum::{
    extract::{Request, State},
    http::{HeaderMap, StatusCode},
    middleware::Next,
    response::Response,
};
use std::sync::Arc;
use tracing::{debug, error, warn};
use uuid::Uuid;

/// Authentication middleware for HTTP requests
pub async fn auth_middleware(
    State(config): State<Arc<Config>>,
    headers: HeaderMap,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let request_id = Uuid::new_v4().to_string();
    
    // Extract authentication from headers
    let auth_result = if config.internal {
        // Internal mode - expect bearer token
        extract_bearer_token(&headers)
            .and_then(|token| authenticate_internal_token(token, &config))
    } else {
        // External mode - expect API key
        extract_api_key(&headers)
            .and_then(|api_key| authenticate_api_key(api_key, &config))
    };

    match auth_result {
        Ok(session) => {
            // Create auth context
            let client_ip = extract_client_ip(&headers);
            let user_agent = extract_user_agent(&headers);
            
            let auth_context = AuthContext::new(session, request_id)
                .with_client_ip(client_ip.unwrap_or_default())
                .with_user_agent(user_agent.unwrap_or_default());

            // Add auth context to request extensions
            request.extensions_mut().insert(auth_context);

            debug!("Authentication successful for request {}", request_id);
            Ok(next.run(request).await)
        }
        Err(e) => {
            warn!("Authentication failed for request {}: {}", request_id, e);
            Err(StatusCode::UNAUTHORIZED)
        }
    }
}

/// Extract API key from headers
fn extract_api_key(headers: &HeaderMap) -> Result<String> {
    headers
        .get("x-api-key")
        .and_then(|value| value.to_str().ok())
        .map(|s| s.to_string())
        .ok_or_else(|| ServerError::Auth("Missing x-api-key header".to_string()))
}

/// Extract bearer token from headers
fn extract_bearer_token(headers: &HeaderMap) -> Result<String> {
    headers
        .get("authorization")
        .and_then(|value| value.to_str().ok())
        .and_then(|auth_header| {
            if auth_header.starts_with("Bearer ") {
                Some(auth_header[7..].to_string())
            } else {
                None
            }
        })
        .ok_or_else(|| ServerError::Auth("Missing or invalid Authorization header".to_string()))
}

/// Extract client IP from headers
fn extract_client_ip(headers: &HeaderMap) -> Option<String> {
    // Try various headers in order of preference
    let ip_headers = [
        "x-forwarded-for",
        "x-real-ip", 
        "x-client-ip",
        "cf-connecting-ip", // Cloudflare
    ];

    for header_name in &ip_headers {
        if let Some(value) = headers.get(header_name) {
            if let Ok(ip_str) = value.to_str() {
                // For x-forwarded-for, take the first IP
                let ip = ip_str.split(',').next().unwrap_or(ip_str).trim();
                if !ip.is_empty() {
                    return Some(ip.to_string());
                }
            }
        }
    }

    None
}

/// Extract user agent from headers
fn extract_user_agent(headers: &HeaderMap) -> Option<String> {
    headers
        .get("user-agent")
        .and_then(|value| value.to_str().ok())
        .map(|s| s.to_string())
}

/// Authenticate API key
fn authenticate_api_key(api_key: String, config: &Config) -> Result<AuthSession> {
    let auth = ApiKeyAuth::new(api_key.clone());
    auth.validate().map_err(|e| ServerError::Auth(e.to_string()))?;

    let account_id = auth.extract_account_id().map_err(|e| ServerError::Auth(e.to_string()))?;

    let principal = Principal {
        principal_type: PrincipalType::ApiKey,
        principal_id: api_key,
        account_id: account_id.clone(),
        user_id: None,
        email: None,
        name: None,
    };

    let mut session = AuthSession::new(principal, account_id);
    
    // Set default org/project if configured
    if let Some(org_id) = &config.default_org_id {
        session = session.with_org_id(org_id.clone());
    }
    if let Some(project_id) = &config.default_project_id {
        session = session.with_project_id(project_id.clone());
    }

    Ok(session)
}

/// Authenticate internal bearer token
fn authenticate_internal_token(token: String, config: &Config) -> Result<AuthSession> {
    // For internal mode, we need to validate the JWT token
    let mcp_secret = config.mcp_svc_secret.as_ref()
        .ok_or_else(|| ServerError::Auth("MCP service secret not configured".to_string()))?;

    let jwt_auth = JwtAuth::new(token.clone(), mcp_secret.clone());
    let claims = jwt_auth.decode_token().map_err(|e| ServerError::Auth(e.to_string()))?;

    if claims.is_expired() {
        return Err(ServerError::Auth("Token has expired".to_string()));
    }

    let account_id = claims.account_id
        .ok_or_else(|| ServerError::Auth("Token missing account_id claim".to_string()))?;

    let principal = Principal {
        principal_type: PrincipalType::User,
        principal_id: claims.sub.clone(),
        account_id: account_id.clone(),
        user_id: claims.user_id.clone(),
        email: claims.email.clone(),
        name: None,
    };

    let mut session = AuthSession::new(principal, account_id);
    
    // Set org/project from token claims
    if let Some(org_id) = claims.org_id {
        session = session.with_org_id(org_id);
    }
    if let Some(project_id) = claims.project_id {
        session = session.with_project_id(project_id);
    }

    // Set permissions from token
    if let Some(permissions) = claims.permissions {
        session = session.with_permissions(permissions);
    }

    // Set expiration
    if let Some(exp_time) = claims.expiration_time() {
        session = session.with_expiration(exp_time);
    }

    Ok(session)
}

/// STDIO authentication for session-based auth
pub fn authenticate_stdio_session(bearer_token: &str, mcp_secret: &str) -> Result<AuthSession> {
    let jwt_auth = JwtAuth::new(bearer_token.to_string(), mcp_secret.to_string());
    let claims = jwt_auth.decode_token().map_err(|e| ServerError::Auth(e.to_string()))?;

    if claims.is_expired() {
        return Err(ServerError::Auth("Token has expired".to_string()));
    }

    let account_id = claims.account_id
        .ok_or_else(|| ServerError::Auth("Token missing account_id claim".to_string()))?;

    let principal = Principal {
        principal_type: PrincipalType::User,
        principal_id: claims.sub.clone(),
        account_id: account_id.clone(),
        user_id: claims.user_id.clone(),
        email: claims.email.clone(),
        name: None,
    };

    let mut session = AuthSession::new(principal, account_id);
    
    if let Some(org_id) = claims.org_id {
        session = session.with_org_id(org_id);
    }
    if let Some(project_id) = claims.project_id {
        session = session.with_project_id(project_id);
    }
    if let Some(permissions) = claims.permissions {
        session = session.with_permissions(permissions);
    }
    if let Some(exp_time) = claims.expiration_time() {
        session = session.with_expiration(exp_time);
    }

    Ok(session)
}

/// Extract auth context from request extensions
pub fn extract_auth_context(request: &Request) -> Option<&AuthContext> {
    request.extensions().get::<AuthContext>()
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    #[test]
    fn test_extract_api_key() {
        let mut headers = HeaderMap::new();
        headers.insert("x-api-key", HeaderValue::from_static("pat.account123.token456.suffix"));
        
        let api_key = extract_api_key(&headers).unwrap();
        assert_eq!(api_key, "pat.account123.token456.suffix");
    }

    #[test]
    fn test_extract_bearer_token() {
        let mut headers = HeaderMap::new();
        headers.insert("authorization", HeaderValue::from_static("Bearer token123"));
        
        let token = extract_bearer_token(&headers).unwrap();
        assert_eq!(token, "token123");
    }

    #[test]
    fn test_extract_client_ip() {
        let mut headers = HeaderMap::new();
        headers.insert("x-forwarded-for", HeaderValue::from_static("192.168.1.1, 10.0.0.1"));
        
        let ip = extract_client_ip(&headers).unwrap();
        assert_eq!(ip, "192.168.1.1");
    }

    #[test]
    fn test_extract_user_agent() {
        let mut headers = HeaderMap::new();
        headers.insert("user-agent", HeaderValue::from_static("test-client/1.0"));
        
        let user_agent = extract_user_agent(&headers).unwrap();
        assert_eq!(user_agent, "test-client/1.0");
    }

    #[test]
    fn test_authenticate_api_key() {
        let config = Config::default();
        let session = authenticate_api_key("pat.account123.token456.suffix".to_string(), &config).unwrap();
        
        assert_eq!(session.account_id, "account123");
        assert!(matches!(session.principal.principal_type, PrincipalType::ApiKey));
    }
}