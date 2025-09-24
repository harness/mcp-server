#!/bin/bash

# Snapshot testing script for Harness MCP Server
# This script runs snapshot tests and provides tools for reviewing changes

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

# Function to run snapshot tests
run_snapshot_tests() {
    print_status "Running snapshot tests..."
    
    # Run snapshot tests for core library
    print_status "Testing harness-mcp-core snapshots..."
    if cargo test --package harness-mcp-core snapshots; then
        print_success "Core library snapshot tests passed"
    else
        print_error "Core library snapshot tests failed"
        return 1
    fi
    
    # Run snapshot tests for client library
    print_status "Testing harness-mcp-client snapshots..."
    if cargo test --package harness-mcp-client dto_snapshots; then
        print_success "Client library snapshot tests passed"
    else
        print_error "Client library snapshot tests failed"
        return 1
    fi
}

# Function to review snapshot changes
review_snapshots() {
    print_status "Reviewing snapshot changes..."
    
    # Check for new or changed snapshots
    if find . -name "*.snap.new" -type f | grep -q .; then
        print_warning "Found new or changed snapshots:"
        find . -name "*.snap.new" -type f
        echo ""
        print_status "To review changes, use:"
        echo "  cargo insta review"
        echo ""
        print_status "To accept all changes, use:"
        echo "  cargo insta accept"
        echo ""
        print_status "To reject all changes, use:"
        echo "  cargo insta reject"
    else
        print_success "No snapshot changes detected"
    fi
}

# Function to generate initial snapshots
generate_snapshots() {
    print_status "Generating initial snapshots..."
    
    # Remove existing snapshots to force regeneration
    find . -name "*.snap" -type f -delete
    
    # Run tests to generate new snapshots
    cargo test --package harness-mcp-core snapshots || true
    cargo test --package harness-mcp-client dto_snapshots || true
    
    # Accept all generated snapshots
    if command -v cargo-insta &> /dev/null; then
        cargo insta accept
        print_success "Initial snapshots generated and accepted"
    else
        print_warning "cargo-insta not found. Install with: cargo install cargo-insta"
        print_warning "Snapshots generated but not automatically accepted"
    fi
}

# Function to validate JSON compatibility
validate_json_compatibility() {
    print_status "Validating JSON compatibility..."
    
    # Create temporary directory for validation
    TEMP_DIR=$(mktemp -d)
    
    # Extract JSON from snapshots and validate structure
    find . -name "*.snap" -type f | while read -r snap_file; do
        if grep -q "expression: " "$snap_file"; then
            # Extract JSON content from snapshot
            sed -n '/^---$/,/^---$/p' "$snap_file" | sed '1d;$d' > "$TEMP_DIR/temp.json"
            
            # Validate JSON syntax
            if jq empty "$TEMP_DIR/temp.json" 2>/dev/null; then
                echo "✓ Valid JSON in $snap_file"
            else
                print_error "Invalid JSON in $snap_file"
            fi
        fi
    done
    
    # Clean up
    rm -rf "$TEMP_DIR"
    print_success "JSON compatibility validation completed"
}

# Function to compare with Go implementation
compare_with_go() {
    print_status "Comparing JSON schemas with Go implementation..."
    
    # This would compare the JSON structures with the Go version
    # For now, just check that key fields are present
    
    print_warning "Go comparison not yet implemented"
    print_status "Manual verification needed:"
    echo "  1. Check that all required MCP protocol fields are present"
    echo "  2. Verify JSON-RPC 2.0 compliance"
    echo "  3. Ensure Harness API compatibility"
}

# Main script logic
case "${1:-run}" in
    "run")
        run_snapshot_tests
        review_snapshots
        ;;
    "generate")
        generate_snapshots
        ;;
    "review")
        review_snapshots
        ;;
    "validate")
        validate_json_compatibility
        ;;
    "compare")
        compare_with_go
        ;;
    "help")
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  run       Run snapshot tests and review changes (default)"
        echo "  generate  Generate initial snapshots"
        echo "  review    Review snapshot changes"
        echo "  validate  Validate JSON compatibility"
        echo "  compare   Compare with Go implementation"
        echo "  help      Show this help message"
        ;;
    *)
        print_error "Unknown command: $1"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac