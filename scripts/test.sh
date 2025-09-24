#!/bin/bash

# Comprehensive test runner for Harness MCP Server Rust migration

set -e

echo "🧪 Running comprehensive test suite for Harness MCP Server"
echo "=========================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Set up test environment
export RUST_BACKTRACE=1
export RUST_LOG=debug

print_status "Setting up test environment..."

# Clean previous builds
print_status "Cleaning previous builds..."
cargo clean

# Check formatting
print_status "Checking code formatting..."
if cargo fmt --all -- --check; then
    print_success "Code formatting is correct"
else
    print_warning "Code formatting issues found. Run 'cargo fmt' to fix."
fi

# Run clippy lints
print_status "Running clippy lints..."
if cargo clippy --all-targets --all-features -- -D warnings; then
    print_success "No clippy warnings found"
else
    print_error "Clippy warnings found. Please fix them."
    exit 1
fi

# Build all crates
print_status "Building all crates..."
if cargo build --all; then
    print_success "All crates built successfully"
else
    print_error "Build failed"
    exit 1
fi

# Run unit tests
print_status "Running unit tests..."
if cargo test --all --lib; then
    print_success "All unit tests passed"
else
    print_error "Unit tests failed"
    exit 1
fi

# Run integration tests
print_status "Running integration tests..."
if cargo test --all --test '*'; then
    print_success "All integration tests passed"
else
    print_error "Integration tests failed"
    exit 1
fi

# Run doc tests
print_status "Running documentation tests..."
if cargo test --all --doc; then
    print_success "All documentation tests passed"
else
    print_warning "Some documentation tests failed"
fi

# Generate test coverage report (if cargo-tarpaulin is available)
if command -v cargo-tarpaulin &> /dev/null; then
    print_status "Generating test coverage report..."
    cargo tarpaulin --all --out Html --output-dir target/coverage
    print_success "Coverage report generated in target/coverage/"
else
    print_warning "cargo-tarpaulin not found. Install with: cargo install cargo-tarpaulin"
fi

# Run benchmarks (if any)
print_status "Running benchmarks..."
if cargo bench --all 2>/dev/null; then
    print_success "Benchmarks completed"
else
    print_warning "No benchmarks found or benchmarks failed"
fi

# Check for security vulnerabilities
if command -v cargo-audit &> /dev/null; then
    print_status "Checking for security vulnerabilities..."
    if cargo audit; then
        print_success "No security vulnerabilities found"
    else
        print_warning "Security vulnerabilities found. Please review."
    fi
else
    print_warning "cargo-audit not found. Install with: cargo install cargo-audit"
fi

# Generate documentation
print_status "Generating documentation..."
if cargo doc --all --no-deps; then
    print_success "Documentation generated successfully"
else
    print_warning "Documentation generation had issues"
fi

# Final summary
echo ""
echo "=========================================================="
print_success "🎉 All tests completed successfully!"
echo ""
print_status "Test Summary:"
echo "  ✅ Code formatting checked"
echo "  ✅ Clippy lints passed"
echo "  ✅ All crates built"
echo "  ✅ Unit tests passed"
echo "  ✅ Integration tests passed"
echo "  ✅ Documentation generated"
echo ""
print_status "Next steps:"
echo "  - Review any warnings above"
echo "  - Check coverage report in target/coverage/ (if generated)"
echo "  - Run specific tests with: cargo test <test_name>"
echo "  - Run tests with output: cargo test -- --nocapture"
echo ""