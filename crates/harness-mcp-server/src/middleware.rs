//! Middleware for Harness MCP Server
//!
//! This module provides middleware for logging, tracing, authentication,
//! and other cross-cutting concerns.

use axum::{
    extract::Request,
    http::{HeaderMap, StatusCode},
    middleware::Next,
    response::Response,
};
use harness_mcp_core::logging::{create_request_span, RequestContext};
use std::time::Instant;
use tracing::{info, warn, Span};
use uuid::Uuid;

/// Request tracing middleware
pub async fn tracing_middleware(request: Request, next: Next) -> Response {
    let method = request.method().to_string();
    let path = request.uri().path().to_string();
    let request_id = Uuid::new_v4().to_string();
    
    let span = create_request_span(&method, &path, &request_id);
    let _enter = span.enter();
    
    let start_time = Instant::now();
    
    // Extract user agent and other headers
    let user_agent = request
        .headers()
        .get("user-agent")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown");
    
    info!(
        request_id = %request_id,
        method = %method,
        path = %path,
        user_agent = %user_agent,
        "Request started"
    );
    
    let response = next.run(request).await;
    
    let duration_ms = start_time.elapsed().as_millis() as u64;
    let status_code = response.status().as_u16();
    
    // Record the response in the span
    Span::current().record("status_code", status_code);
    Span::current().record("duration_ms", duration_ms);
    
    if status_code >= 400 {
        warn!(
            request_id = %request_id,
            method = %method,
            path = %path,
            status_code = status_code,
            duration_ms = duration_ms,
            "Request completed with error"
        );
    } else {
        info!(
            request_id = %request_id,
            method = %method,
            path = %path,
            status_code = status_code,
            duration_ms = duration_ms,
            "Request completed successfully"
        );
    }
    
    response
}

/// Authentication middleware
pub async fn auth_middleware(
    headers: HeaderMap,
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let span = tracing::info_span!("authentication");
    let _enter = span.enter();
    
    // Extract authentication information
    let auth_type = if headers.contains_key("x-api-key") {
        "api_key"
    } else if headers.contains_key("authorization") {
        "bearer_token"
    } else {
        "none"
    };
    
    info!(
        auth_type = auth_type,
        "Processing authentication"
    );
    
    // For now, we'll allow all requests through
    // In a real implementation, you would validate the credentials here
    
    let response = next.run(request).await;
    
    info!(
        auth_type = auth_type,
        success = true,
        "Authentication completed"
    );
    
    Ok(response)
}

/// CORS middleware
pub async fn cors_middleware(request: Request, next: Next) -> Response {
    let response = next.run(request).await;
    
    let mut response = response;
    let headers = response.headers_mut();
    
    headers.insert("Access-Control-Allow-Origin", "*".parse().unwrap());
    headers.insert("Access-Control-Allow-Methods", "GET, POST, OPTIONS".parse().unwrap());
    headers.insert("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key".parse().unwrap());
    
    response
}

/// Error handling middleware
pub async fn error_handling_middleware(request: Request, next: Next) -> Response {
    let response = next.run(request).await;
    
    // Log any 5xx errors
    if response.status().is_server_error() {
        warn!(
            status_code = response.status().as_u16(),
            "Server error occurred"
        );
    }
    
    response
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::Body,
        http::{Method, Request, StatusCode},
        middleware,
        response::Response,
        routing::get,
        Router,
    };
    use tower::ServiceExt;

    async fn test_handler() -> &'static str {
        "test response"
    }

    #[tokio::test]
    async fn test_tracing_middleware() {
        let app = Router::new()
            .route("/test", get(test_handler))
            .layer(middleware::from_fn(tracing_middleware));

        let request = Request::builder()
            .method(Method::GET)
            .uri("/test")
            .header("user-agent", "test-agent")
            .body(Body::empty())
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_cors_middleware() {
        let app = Router::new()
            .route("/test", get(test_handler))
            .layer(middleware::from_fn(cors_middleware));

        let request = Request::builder()
            .method(Method::GET)
            .uri("/test")
            .body(Body::empty())
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        
        let headers = response.headers();
        assert!(headers.contains_key("access-control-allow-origin"));
        assert!(headers.contains_key("access-control-allow-methods"));
        assert!(headers.contains_key("access-control-allow-headers"));
    }
}