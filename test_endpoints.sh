#!/bin/bash

# Test script to validate MCP endpoints behave identically to Go version

echo "Testing Rust MCP Server Endpoints"
echo "=================================="

# Start the server in background
cd harness-mcp-server
cargo run -- http-server --mcp-svc-secret test-secret &
SERVER_PID=$!

# Wait for server to start
sleep 3

# Test health endpoint
echo "Testing health endpoint..."
curl -s http://localhost:8080/health | jq .

# Test MCP initialize endpoint
echo -e "\nTesting MCP initialize..."
curl -s -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
      },
      "capabilities": {}
    }
  }' | jq .

# Test tools/list endpoint
echo -e "\nTesting tools/list..."
curl -s -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
  }' | jq .

# Test tools/call endpoint
echo -e "\nTesting tools/call..."
curl -s -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "list_pipelines",
      "arguments": {
        "account_id": "test-account"
      }
    }
  }' | jq .

# Test resources/list endpoint
echo -e "\nTesting resources/list..."
curl -s -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 4,
    "method": "resources/list",
    "params": {}
  }' | jq .

# Test prompts/list endpoint
echo -e "\nTesting prompts/list..."
curl -s -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 5,
    "method": "prompts/list",
    "params": {}
  }' | jq .

# Test invalid method
echo -e "\nTesting invalid method..."
curl -s -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 6,
    "method": "invalid/method",
    "params": {}
  }' | jq .

# Test invalid JSON-RPC
echo -e "\nTesting invalid JSON-RPC..."
curl -s -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "1.0",
    "id": 7,
    "method": "initialize"
  }' | jq .

# Clean up
kill $SERVER_PID
echo -e "\nTest completed!"