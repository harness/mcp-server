#!/bin/bash

echo "Running stress test on Rust MCP Server"
echo "======================================"

# Start the server in background
cd harness-mcp-server
cargo run -- http-server --port 8082 &
SERVER_PID=$!

# Wait for server to start
sleep 2

echo "Server started with PID: $SERVER_PID"

# Function to make concurrent requests
make_requests() {
    local endpoint=$1
    local data=$2
    local count=$3
    
    for i in $(seq 1 $count); do
        curl -s -X POST http://localhost:8082/mcp \
          -H "Content-Type: application/json" \
          -d "$data" > /dev/null &
    done
    wait
}

# Test 1: Health endpoint stress test
echo "Testing health endpoint with 50 concurrent requests..."
for i in $(seq 1 50); do
    curl -s http://localhost:8082/health > /dev/null &
done
wait
echo "Health endpoint test completed"

# Test 2: MCP initialize stress test
echo "Testing MCP initialize with 20 concurrent requests..."
make_requests "/mcp" '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
        "protocolVersion": "2024-11-05",
        "clientInfo": {
            "name": "stress-test-client",
            "version": "1.0.0"
        }
    }
}' 20
echo "MCP initialize test completed"

# Test 3: Tools list stress test
echo "Testing tools/list with 30 concurrent requests..."
make_requests "/mcp" '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
}' 30
echo "Tools list test completed"

# Test 4: Invalid requests stress test
echo "Testing invalid requests with 15 concurrent requests..."
make_requests "/mcp" '{
    "jsonrpc": "1.0",
    "id": 3,
    "method": "invalid/method"
}' 15
echo "Invalid requests test completed"

# Test 5: Mixed load test
echo "Running mixed load test with 100 total requests..."
for i in $(seq 1 25); do
    # Health checks
    curl -s http://localhost:8082/health > /dev/null &
    
    # MCP requests
    curl -s -X POST http://localhost:8082/mcp \
      -H "Content-Type: application/json" \
      -d '{"jsonrpc": "2.0", "id": '$i', "method": "tools/list"}' > /dev/null &
    
    # Invalid JSON
    curl -s -X POST http://localhost:8082/mcp \
      -H "Content-Type: application/json" \
      -d 'invalid json' > /dev/null &
    
    # Invalid method
    curl -s -X POST http://localhost:8082/mcp \
      -H "Content-Type: application/json" \
      -d '{"jsonrpc": "2.0", "id": '$i', "method": "nonexistent"}' > /dev/null &
done
wait
echo "Mixed load test completed"

# Check if server is still running
if kill -0 $SERVER_PID 2>/dev/null; then
    echo "✅ SUCCESS: Server is still running after stress test"
    kill $SERVER_PID
    echo "Server stopped"
else
    echo "❌ FAILURE: Server crashed during stress test"
    exit 1
fi

echo "Stress test completed successfully - no panics detected!"