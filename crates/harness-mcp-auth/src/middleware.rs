//! Authentication middleware

use crate::error::{Error, Result};
use crate::session::{authenticate_session, Session};
use axum::{
    extract::{Request, State},
    http::{HeaderMap, StatusCode},
    middleware::Next,
    response::Response,
};
use std::sync::Arc;

/// Authentication middleware state
#[derive(Clone)]
pub struct AuthMiddlewareState {
    pub mcp_svc_secret: String,
}

impl AuthMiddlewareState {
    /// Create new auth middleware state
    pub fn new(mcp_svc_secret: String) -> Self {
        Self { mcp_svc_secret }
    }
}

/// Authentication middleware for HTTP requests
pub async fn auth_middleware(
    State(state): State<AuthMiddlewareState>,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Extract the Authorization header
    let auth_header = request
        .headers()
        .get("authorization")
        .and_then(|h| h.to_str().ok())
        .unwrap_or("");

    let parts: Vec<&str> = auth_header.split(' ').collect();
    
    if parts.len() != 2 || parts[0] != "Bearer" {
        tracing::error!("Invalid authorization header");
        return Err(StatusCode::UNAUTHORIZED);
    }

    let token = parts[1];
    let session = authenticate_session(token, state.mcp_svc_secret.as_bytes())
        .map_err(|e| {
            tracing::error!("Failed to authenticate session: {}", e);
            StatusCode::UNAUTHORIZED
        })?;

    // Add session to request extensions
    request.extensions_mut().insert(Arc::new(session));

    // Continue to next middleware/handler
    Ok(next.run(request).await)
}

/// Extract session from request extensions
pub fn extract_session(request: &Request) -> Option<Arc<Session>> {
    request.extensions().get::<Arc<Session>>().cloned()
}