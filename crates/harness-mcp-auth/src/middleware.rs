//! Authentication middleware

use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::Response,
};
use harness_mcp_core::config::Config;
use std::sync::Arc;

/// Authentication middleware
pub struct AuthMiddleware;

impl AuthMiddleware {
    /// Create authentication middleware
    pub async fn auth_middleware(
        State(_config): State<Arc<Config>>,
        request: Request,
        next: Next,
    ) -> Result<Response, StatusCode> {
        // TODO: Implement authentication logic
        // For now, just pass through
        Ok(next.run(request).await)
    }
}
