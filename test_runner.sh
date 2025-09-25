#!/bin/bash

# Test runner script for Rust MCP Server

set -e

echo "🧪 Running Rust MCP Server Tests"
echo "================================="

# Function to run tests for a specific crate
run_crate_tests() {
    local crate_name=$1
    echo ""
    echo "📦 Testing crate: $crate_name"
    echo "----------------------------"
    
    cd "crates/$crate_name"
    
    # Run unit tests
    echo "Running unit tests..."
    cargo test --lib
    
    # Run integration tests if they exist
    if [ -d "tests" ]; then
        echo "Running integration tests..."
        cargo test --tests
    fi
    
    # Run doc tests
    echo "Running doc tests..."
    cargo test --doc
    
    cd ../..
}

# Test all crates
echo "Testing all workspace crates..."

run_crate_tests "harness-mcp-auth"
run_crate_tests "harness-mcp-core" 
run_crate_tests "harness-mcp-client"
run_crate_tests "harness-mcp-tools"
run_crate_tests "harness-mcp-config"
run_crate_tests "harness-mcp-server"

echo ""
echo "🎯 Running workspace-wide tests..."
echo "=================================="

# Run all tests in workspace
cargo test --workspace

echo ""
echo "🔍 Running clippy lints..."
echo "=========================="

# Run clippy for all crates
cargo clippy --workspace --all-targets -- -D warnings

echo ""
echo "📝 Checking formatting..."
echo "========================="

# Check formatting
cargo fmt --all -- --check

echo ""
echo "✅ All tests completed successfully!"
echo "===================================="