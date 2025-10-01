use super::*;
use crate::error::{authentication_error, Result};
use axum::{
    extract::{Request, State},
    http::{HeaderMap, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use std::sync::Arc;

#[derive(Clone)]
pub struct AuthState {
    pub provider: Arc<dyn AuthProvider>,
}

impl AuthState {
    pub fn new(provider: Arc<dyn AuthProvider>) -> Self {
        Self { provider }
    }
}

pub async fn auth_middleware(
    State(auth_state): State<AuthState>,
    headers: HeaderMap,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Extract authorization header
    let auth_header = headers
        .get("authorization")
        .or_else(|| headers.get("x-api-key"))
        .and_then(|h| h.to_str().ok())
        .ok_or(StatusCode::UNAUTHORIZED)?;
    
    // Parse token from header
    let token = if auth_header.starts_with("Bearer ") {
        auth_header.strip_prefix("Bearer ").unwrap_or("")
    } else {
        auth_header
    };
    
    // Authenticate
    let session = auth_state
        .provider
        .authenticate(token)
        .await
        .map_err(|_| StatusCode::UNAUTHORIZED)?;
    
    // Add session to request extensions
    request.extensions_mut().insert(session);
    
    Ok(next.run(request).await)
}

// Helper to extract auth session from request
pub fn get_auth_session(request: &Request) -> Option<&AuthSession> {
    request.extensions().get::<AuthSession>()
}