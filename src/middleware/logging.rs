use axum::{extract::Request, middleware::Next, response::Response};
use tracing::{info, warn};

pub async fn logging_middleware(request: Request, next: Next) -> Response {
    let method = request.method().clone();
    let uri = request.uri().clone();
    
    info!("Incoming request: {} {}", method, uri);
    
    let start = std::time::Instant::now();
    let response = next.run(request).await;
    let duration = start.elapsed();
    
    let status = response.status();
    if status.is_success() {
        info!("Request completed: {} {} - {} in {:?}", method, uri, status, duration);
    } else {
        warn!("Request failed: {} {} - {} in {:?}", method, uri, status, duration);
    }
    
    response
}