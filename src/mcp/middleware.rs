use axum::{
    extract::Request,
    http::{HeaderValue, Method},
    middleware::Next,
    response::Response,
};
use std::time::Instant;
use tracing::{info, warn};
use uuid::Uuid;

/// Middleware for request logging and timing
pub async fn logging_middleware(request: Request, next: Next) -> Response {
    let start = Instant::now();
    let method = request.method().clone();
    let uri = request.uri().clone();
    let request_id = Uuid::new_v4().to_string();

    // Add request ID to headers for tracing
    let mut request = request;
    request.headers_mut().insert(
        "x-request-id",
        HeaderValue::from_str(&request_id).unwrap(),
    );

    info!(
        request_id = %request_id,
        method = %method,
        uri = %uri,
        "Processing request"
    );

    let response = next.run(request).await;
    let duration = start.elapsed();

    let status = response.status();
    if status.is_success() {
        info!(
            request_id = %request_id,
            method = %method,
            uri = %uri,
            status = %status,
            duration_ms = duration.as_millis(),
            "Request completed"
        );
    } else {
        warn!(
            request_id = %request_id,
            method = %method,
            uri = %uri,
            status = %status,
            duration_ms = duration.as_millis(),
            "Request failed"
        );
    }

    response
}

/// Middleware for CORS handling
pub async fn cors_middleware(request: Request, next: Next) -> Response {
    let method = request.method().clone();
    
    // Handle preflight requests
    if method == Method::OPTIONS {
        return Response::builder()
            .status(200)
            .header("Access-Control-Allow-Origin", "*")
            .header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
            .header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key")
            .header("Access-Control-Max-Age", "86400")
            .body(axum::body::Body::empty())
            .unwrap();
    }

    let mut response = next.run(request).await;
    
    // Add CORS headers to all responses
    response.headers_mut().insert(
        "Access-Control-Allow-Origin",
        HeaderValue::from_static("*"),
    );
    response.headers_mut().insert(
        "Access-Control-Allow-Methods",
        HeaderValue::from_static("GET, POST, PUT, DELETE, OPTIONS"),
    );
    response.headers_mut().insert(
        "Access-Control-Allow-Headers",
        HeaderValue::from_static("Content-Type, Authorization, x-api-key"),
    );

    response
}

/// Middleware for API key validation (when required)
pub async fn auth_middleware(request: Request, next: Next) -> Response {
    // For now, just pass through - auth will be handled at the tool level
    // This middleware can be enhanced to validate API keys globally
    next.run(request).await
}