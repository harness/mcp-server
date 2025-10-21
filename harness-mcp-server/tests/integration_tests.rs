use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use harness_mcp_server::{
    config::Config,
    server::http_server::{create_app, HttpServerState},
    types::{log_format::LogFormat, transport::TransportType},
};
use serde_json::{json, Value};
use tower::ServiceExt;

fn create_test_config() -> Config {
    Config {
        debug: false,
        transport: TransportType::Http,
        stdio_config: None,
        http_config: None,
    }
}

#[tokio::test]
async fn test_health_endpoint() {
    let config = create_test_config();
    let state = HttpServerState { config };
    
    let app = create_app(state);
    
    let request = Request::builder()
        .uri("/health")
        .body(Body::empty())
        .unwrap();
    
    let response = app.oneshot(request).await.unwrap();
    
    assert_eq!(response.status(), StatusCode::OK);
    
    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();
    
    assert_eq!(json["status"], "healthy");
    assert_eq!(json["service"], "harness-mcp-server");
}

#[tokio::test]
async fn test_mcp_initialize() {
    let config = create_test_config();
    let state = HttpServerState { config };
    
    let app = create_app(state);
    
    let request_body = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "clientInfo": {
                "name": "test-client",
                "version": "1.0.0"
            }
        }
    });
    
    let request = Request::builder()
        .uri("/mcp")
        .method("POST")
        .header("content-type", "application/json")
        .body(Body::from(serde_json::to_vec(&request_body).unwrap()))
        .unwrap();
    
    let response = app.oneshot(request).await.unwrap();
    
    assert_eq!(response.status(), StatusCode::OK);
    
    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();
    
    assert_eq!(json["jsonrpc"], "2.0");
    assert_eq!(json["id"], 1);
    assert!(json["result"].is_object());
    assert_eq!(json["result"]["protocolVersion"], "2024-11-05");
    assert!(json["result"]["capabilities"].is_object());
    assert!(json["result"]["serverInfo"].is_object());
}

#[tokio::test]
async fn test_mcp_tools_list() {
    let config = create_test_config();
    let state = HttpServerState { config };
    
    let app = create_app(state);
    
    let request_body = json!({
        "jsonrpc": "2.0",
        "id": 2,
        "method": "tools/list"
    });
    
    let request = Request::builder()
        .uri("/mcp")
        .method("POST")
        .header("content-type", "application/json")
        .body(Body::from(serde_json::to_vec(&request_body).unwrap()))
        .unwrap();
    
    let response = app.oneshot(request).await.unwrap();
    
    assert_eq!(response.status(), StatusCode::OK);
    
    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();
    
    assert_eq!(json["jsonrpc"], "2.0");
    assert_eq!(json["id"], 2);
    assert!(json["result"]["tools"].is_array());
}

#[tokio::test]
async fn test_mcp_invalid_method() {
    let config = create_test_config();
    let state = HttpServerState { config };
    
    let app = create_app(state);
    
    let request_body = json!({
        "jsonrpc": "2.0",
        "id": 4,
        "method": "invalid/method"
    });
    
    let request = Request::builder()
        .uri("/mcp")
        .method("POST")
        .header("content-type", "application/json")
        .body(Body::from(serde_json::to_vec(&request_body).unwrap()))
        .unwrap();
    
    let response = app.oneshot(request).await.unwrap();
    
    assert_eq!(response.status(), StatusCode::OK);
    
    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();
    
    assert_eq!(json["jsonrpc"], "2.0");
    assert_eq!(json["id"], 4);
    assert!(json["error"].is_object());
    assert_eq!(json["error"]["code"], -32601);
    assert_eq!(json["error"]["message"], "Method not found");
}

#[tokio::test]
async fn test_mcp_invalid_json() {
    let config = create_test_config();
    let state = HttpServerState { config };
    
    let app = create_app(state);
    
    let request = Request::builder()
        .uri("/mcp")
        .method("POST")
        .header("content-type", "application/json")
        .body(Body::from("invalid json"))
        .unwrap();
    
    let response = app.oneshot(request).await.unwrap();
    
    assert_eq!(response.status(), StatusCode::OK);
    
    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();
    
    assert_eq!(json["jsonrpc"], "2.0");
    assert!(json["error"].is_object());
    assert_eq!(json["error"]["code"], -32700);
    assert_eq!(json["error"]["message"], "Parse error");
}

#[tokio::test]
async fn test_server_no_panics_under_load() {
    let config = create_test_config();
    let state = HttpServerState { config };
    
    let app = create_app(state);
    
    // Test multiple concurrent requests to ensure no panics
    let mut handles = vec![];
    
    for i in 0..10 {
        let app_clone = app.clone();
        let handle = tokio::spawn(async move {
            let request_body = json!({
                "jsonrpc": "2.0",
                "id": i,
                "method": "tools/list"
            });
            
            let request = Request::builder()
                .uri("/mcp")
                .method("POST")
                .header("content-type", "application/json")
                .body(Body::from(serde_json::to_vec(&request_body).unwrap()))
                .unwrap();
            
            let response = app_clone.oneshot(request).await.unwrap();
            assert_eq!(response.status(), StatusCode::OK);
        });
        handles.push(handle);
    }
    
    // Wait for all requests to complete
    for handle in handles {
        handle.await.unwrap();
    }
}