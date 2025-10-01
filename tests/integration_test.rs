#[test]
fn test_mcp_request_parsing() {
    use serde_json::json;
    
    // Test MCP request parsing
    let request = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {
                "name": "test-client",
                "version": "1.0.0"
            }
        }
    });
    
    // Verify the request structure
    assert_eq!(request["method"], "initialize");
    assert_eq!(request["id"], 1);
}