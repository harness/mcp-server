#!/bin/bash

# Validation script for Harness MCP Server Rust migration
# This script validates the migration without requiring Rust to be installed

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "Cargo.toml" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

echo "🔍 Validating Harness MCP Server Rust Migration"
echo "=============================================="

# Validation counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

check_file() {
    local file="$1"
    local description="$2"
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    if [ -f "$file" ]; then
        print_success "$description"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        return 0
    else
        print_error "$description"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        return 1
    fi
}

check_directory() {
    local dir="$1"
    local description="$2"
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    if [ -d "$dir" ]; then
        print_success "$description"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        return 0
    else
        print_error "$description"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        return 1
    fi
}

check_content() {
    local file="$1"
    local pattern="$2"
    local description="$3"
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    if [ -f "$file" ] && grep -q "$pattern" "$file"; then
        print_success "$description"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        return 0
    else
        print_error "$description"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        return 1
    fi
}

print_status "Checking project structure..."

# Check workspace structure
check_file "Cargo.toml" "Workspace Cargo.toml exists"
check_content "Cargo.toml" "workspace" "Workspace configuration present"
check_content "Cargo.toml" "harness-mcp-server" "Server crate in workspace"
check_content "Cargo.toml" "harness-mcp-core" "Core crate in workspace"
check_content "Cargo.toml" "harness-mcp-client" "Client crate in workspace"

# Check individual crates
check_directory "harness-mcp-server" "Server crate directory exists"
check_file "harness-mcp-server/Cargo.toml" "Server crate Cargo.toml exists"
check_file "harness-mcp-server/src/main.rs" "Server main.rs exists"

check_directory "harness-mcp-core" "Core crate directory exists"
check_file "harness-mcp-core/Cargo.toml" "Core crate Cargo.toml exists"
check_file "harness-mcp-core/src/lib.rs" "Core lib.rs exists"

check_directory "harness-mcp-client" "Client crate directory exists"
check_file "harness-mcp-client/Cargo.toml" "Client crate Cargo.toml exists"
check_file "harness-mcp-client/src/lib.rs" "Client lib.rs exists"

print_status "Checking core modules..."

# Check core modules
check_file "harness-mcp-core/src/config.rs" "Configuration module exists"
check_file "harness-mcp-core/src/error.rs" "Error handling module exists"
check_file "harness-mcp-core/src/mcp.rs" "MCP protocol module exists"
check_file "harness-mcp-core/src/protocol.rs" "Protocol handler module exists"
check_file "harness-mcp-core/src/server.rs" "Server module exists"
check_file "harness-mcp-core/src/tools.rs" "Tools module exists"
check_file "harness-mcp-core/src/transport.rs" "Transport module exists"
check_file "harness-mcp-core/src/types.rs" "Types module exists"
check_file "harness-mcp-core/src/logging.rs" "Logging module exists"

print_status "Checking client modules..."

# Check client modules
check_file "harness-mcp-client/src/client.rs" "Client module exists"
check_file "harness-mcp-client/src/dto.rs" "DTO module exists"
check_file "harness-mcp-client/src/error.rs" "Client error module exists"

print_status "Checking test infrastructure..."

# Check test files
check_directory "harness-mcp-core/tests" "Core tests directory exists"
check_file "harness-mcp-core/tests/integration_tests.rs" "Core integration tests exist"
check_file "harness-mcp-core/tests/snapshots.rs" "Core snapshot tests exist"

check_directory "harness-mcp-client/tests" "Client tests directory exists"
check_file "harness-mcp-client/tests/client_tests.rs" "Client tests exist"
check_file "harness-mcp-client/tests/dto_snapshots.rs" "Client snapshot tests exist"

check_directory "harness-mcp-server/tests" "Server tests directory exists"
check_file "harness-mcp-server/tests/cli_tests.rs" "Server CLI tests exist"

check_file "tests/compatibility_tests.rs" "Compatibility tests exist"
check_file "tests/test_config.toml" "Test configuration exists"

print_status "Checking test fixtures..."

# Check test fixtures
check_directory "tests/fixtures" "Test fixtures directory exists"
check_file "tests/fixtures/stdio_input.jsonl" "Stdio input fixture exists"
check_file "tests/fixtures/stdio_expected_output.jsonl" "Stdio output fixture exists"

print_status "Checking scripts and tools..."

# Check scripts
check_directory "scripts" "Scripts directory exists"
check_file "scripts/test.sh" "Test runner script exists"
check_file "scripts/snapshot_tests.sh" "Snapshot test script exists"
check_file "scripts/validate_migration.sh" "Migration validation script exists"

print_status "Checking documentation..."

# Check documentation
check_file "README.md" "README exists"
check_file "RUST_MIGRATION.md" "Migration documentation exists"
check_file ".env.example" "Environment example exists"

print_status "Validating configuration compatibility..."

# Check configuration compatibility
check_content "harness-mcp-core/src/config.rs" "HARNESS_API_KEY" "API key environment variable preserved"
check_content "harness-mcp-core/src/config.rs" "HARNESS_BASE_URL" "Base URL environment variable preserved"
check_content "harness-mcp-core/src/config.rs" "HARNESS_DEFAULT_ORG_ID" "Org ID environment variable preserved"
check_content "harness-mcp-core/src/config.rs" "HARNESS_DEFAULT_PROJECT_ID" "Project ID environment variable preserved"

print_status "Validating MCP protocol implementation..."

# Check MCP protocol implementation
check_content "harness-mcp-core/src/mcp.rs" "2024-11-05" "MCP protocol version correct"
check_content "harness-mcp-core/src/mcp.rs" "JsonRpcRequest" "JSON-RPC request structure exists"
check_content "harness-mcp-core/src/mcp.rs" "JsonRpcResponse" "JSON-RPC response structure exists"
check_content "harness-mcp-core/src/mcp.rs" "InitializeResponse" "MCP initialize response exists"
check_content "harness-mcp-core/src/mcp.rs" "ListToolsResponse" "MCP tools list response exists"
check_content "harness-mcp-core/src/mcp.rs" "CallToolResponse" "MCP tool call response exists"

print_status "Validating transport layers..."

# Check transport implementations
check_content "harness-mcp-core/src/transport.rs" "HttpTransport" "HTTP transport exists"
check_content "harness-mcp-core/src/transport.rs" "StdioTransport" "Stdio transport exists"
check_content "harness-mcp-core/src/transport.rs" "axum" "Axum web framework used"

print_status "Validating dependencies..."

# Check key dependencies
check_content "Cargo.toml" "tokio" "Tokio async runtime included"
check_content "Cargo.toml" "axum" "Axum web framework included"
check_content "Cargo.toml" "serde" "Serde serialization included"
check_content "Cargo.toml" "clap" "Clap CLI framework included"
check_content "Cargo.toml" "tracing" "Tracing logging included"
check_content "Cargo.toml" "thiserror" "Thiserror error handling included"
check_content "Cargo.toml" "insta" "Insta snapshot testing included"

print_status "Checking code quality indicators..."

# Check for proper error handling
check_content "harness-mcp-core/src/error.rs" "thiserror" "Thiserror used for error types"
check_content "harness-mcp-core/src/error.rs" "McpError" "Custom error type defined"

# Check for async/await usage
check_content "harness-mcp-core/src/protocol.rs" "async" "Async functions used"
check_content "harness-mcp-core/src/transport.rs" "async" "Async transport implementation"

# Check for proper serialization
check_content "harness-mcp-core/src/mcp.rs" "serde" "Serde serialization used"
check_content "harness-mcp-client/src/dto.rs" "serde" "Client DTOs use serde"

print_status "Validating test coverage..."

# Count test functions
UNIT_TESTS=$(find . -name "*.rs" -exec grep -l "#\[test\]" {} \; | wc -l)
ASYNC_TESTS=$(find . -name "*.rs" -exec grep -l "#\[tokio::test\]" {} \; | wc -l)
SNAPSHOT_TESTS=$(find . -name "*.rs" -exec grep -l "assert_json_snapshot" {} \; | wc -l)

print_status "Test coverage analysis:"
echo "  Unit test files: $UNIT_TESTS"
echo "  Async test files: $ASYNC_TESTS"
echo "  Snapshot test files: $SNAPSHOT_TESTS"

if [ $UNIT_TESTS -gt 0 ]; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
    print_success "Unit tests present"
else
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
    print_error "No unit tests found"
fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

if [ $ASYNC_TESTS -gt 0 ]; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
    print_success "Async tests present"
else
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
    print_error "No async tests found"
fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

if [ $SNAPSHOT_TESTS -gt 0 ]; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
    print_success "Snapshot tests present"
else
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
    print_error "No snapshot tests found"
fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

# Final summary
echo ""
echo "=============================================="
echo "🎯 VALIDATION SUMMARY"
echo "=============================================="
echo "Total checks: $TOTAL_CHECKS"
echo "Passed: $PASSED_CHECKS"
echo "Failed: $FAILED_CHECKS"

PASS_RATE=$((PASSED_CHECKS * 100 / TOTAL_CHECKS))
echo "Pass rate: $PASS_RATE%"

if [ $FAILED_CHECKS -eq 0 ]; then
    print_success "🎉 All validation checks passed!"
    echo ""
    print_status "Migration appears to be complete and well-structured."
    print_status "Next steps:"
    echo "  1. Install Rust toolchain (rustup.rs)"
    echo "  2. Run 'cargo check --all' to verify compilation"
    echo "  3. Run 'cargo test --all' to execute tests"
    echo "  4. Run './scripts/test.sh' for comprehensive testing"
    echo "  5. Run './scripts/snapshot_tests.sh generate' to create snapshots"
    exit 0
elif [ $PASS_RATE -ge 90 ]; then
    print_warning "⚠️  Migration mostly complete with minor issues ($PASS_RATE% pass rate)"
    echo ""
    print_status "Most components are in place. Address the failed checks above."
    exit 1
elif [ $PASS_RATE -ge 70 ]; then
    print_warning "⚠️  Migration partially complete ($PASS_RATE% pass rate)"
    echo ""
    print_status "Significant work remains. Review failed checks above."
    exit 1
else
    print_error "❌ Migration incomplete ($PASS_RATE% pass rate)"
    echo ""
    print_status "Major components are missing. Significant work required."
    exit 1
fi