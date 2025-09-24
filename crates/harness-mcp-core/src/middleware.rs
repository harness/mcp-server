//! Middleware implementations

use crate::{config::Config, types::HarnessScope};
use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::Response,
};
use std::sync::Arc;
use tracing::warn;

/// Middleware to extract and validate Harness scope information
pub async fn harness_scope_middleware(
    State(config): State<Arc<Config>>,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Extract scope information from request headers or config
    let scope = extract_harness_scope(&config, &request)?;

    // Add scope to request extensions for use by handlers
    request.extensions_mut().insert(scope);

    Ok(next.run(request).await)
}

/// Extract Harness scope from request and configuration
fn extract_harness_scope(config: &Config, _request: &Request) -> Result<HarnessScope, StatusCode> {
    // For external mode, use account ID from API key
    if !config.internal {
        let account_id = config.account_id.as_ref().ok_or_else(|| {
            warn!("Account ID not found in configuration");
            StatusCode::UNAUTHORIZED
        })?;

        return Ok(HarnessScope {
            account_id: account_id.clone(),
            org_id: config.default_org_id.clone(),
            project_id: config.default_project_id.clone(),
        });
    }

    // For internal mode, extract from bearer token or session
    // TODO: Implement session extraction from bearer token
    warn!("Internal mode scope extraction not yet implemented");
    Err(StatusCode::INTERNAL_SERVER_ERROR)
}

/// Middleware for request logging
pub async fn logging_middleware(request: Request, next: Next) -> Response {
    let method = request.method().clone();
    let uri = request.uri().clone();

    tracing::info!("Processing request: {} {}", method, uri);

    let response = next.run(request).await;

    tracing::info!(
        "Request completed: {} {} -> {}",
        method,
        uri,
        response.status()
    );

    response
}
