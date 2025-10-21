use axum::{
    extract::Request,
    http::{HeaderMap, StatusCode},
    middleware::Next,
    response::Response,
};
use tracing::{info, warn};
use std::time::Instant;

/// Middleware for request rate limiting
pub async fn rate_limiting_middleware(
    headers: HeaderMap,
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Extract client IP for rate limiting
    let client_ip = headers
        .get("x-forwarded-for")
        .or_else(|| headers.get("x-real-ip"))
        .and_then(|h| h.to_str().ok())
        .unwrap_or("unknown");
    
    // TODO: Implement actual rate limiting logic
    // For now, just log the request
    info!("Request from client: {}", client_ip);
    
    Ok(next.run(request).await)
}

/// Middleware for request size validation
pub async fn request_size_middleware(
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Check content-length header
    if let Some(content_length) = request.headers().get("content-length") {
        if let Ok(length_str) = content_length.to_str() {
            if let Ok(length) = length_str.parse::<usize>() {
                const MAX_SIZE: usize = 10 * 1024 * 1024; // 10MB
                if length > MAX_SIZE {
                    warn!("Request too large: {} bytes", length);
                    return Err(StatusCode::PAYLOAD_TOO_LARGE);
                }
            }
        }
    }
    
    Ok(next.run(request).await)
}

/// Middleware for security headers
pub async fn security_headers_middleware(
    request: Request,
    next: Next,
) -> Response {
    let mut response = next.run(request).await;
    
    let headers = response.headers_mut();
    
    // Add security headers
    headers.insert("X-Content-Type-Options", "nosniff".parse().unwrap());
    headers.insert("X-Frame-Options", "DENY".parse().unwrap());
    headers.insert("X-XSS-Protection", "1; mode=block".parse().unwrap());
    headers.insert(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains".parse().unwrap(),
    );
    headers.insert(
        "Content-Security-Policy",
        "default-src 'self'".parse().unwrap(),
    );
    
    response
}

/// Middleware for request timing
pub async fn timing_middleware(
    request: Request,
    next: Next,
) -> Response {
    let start = Instant::now();
    let method = request.method().clone();
    let uri = request.uri().clone();
    
    let response = next.run(request).await;
    
    let duration = start.elapsed();
    let status = response.status();
    
    // Log slow requests
    if duration.as_millis() > 1000 {
        warn!(
            "Slow request: {} {} {} took {:?}",
            method,
            uri,
            status.as_u16(),
            duration
        );
    }
    
    response
}