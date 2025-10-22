//! Integration tests for Harness MCP Server

use harness_mcp_server::{Config, SERVER_NAME, VERSION};

#[tokio::test]
async fn test_config_loading() {
    let config = Config::default();
    assert_eq!(config.version, VERSION);
    assert_eq!(config.http.port, 8080);
    assert_eq!(config.http.path, "/mcp");
}

#[tokio::test]
async fn test_server_creation() {
    // This test will be expanded once we implement the full server
    let config = Config::default();
    assert!(!config.debug);
    assert_eq!(config.base_url, "https://app.harness.io");
}

// TODO: Add more integration tests
// - HTTP server startup and shutdown
// - STDIO server communication
// - Tool registration and execution
// - Authentication flows
// - Error handling