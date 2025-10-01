use axum::{extract::Request, middleware::Next, response::Response};
use std::time::Duration;
use tokio::time::timeout;
use tracing::warn;

pub async fn timeout_middleware(request: Request, next: Next) -> Response {
    let timeout_duration = Duration::from_secs(30);
    
    match timeout(timeout_duration, next.run(request)).await {
        Ok(response) => response,
        Err(_) => {
            warn!("Request timed out after {:?}", timeout_duration);
            use axum::http::StatusCode;
            use axum::response::IntoResponse;
            
            (StatusCode::REQUEST_TIMEOUT, "Request timeout").into_response()
        }
    }
}