# Harness MCP Server - Rust Implementation
.PHONY: build test clean fmt clippy run-stdio run-http install dev-deps

# Default target
all: fmt clippy test build

# Build the project
build:
	cargo build --release

# Build for development
build-dev:
	cargo build

# Run tests
test:
	cargo test

# Run tests with output
test-verbose:
	cargo test -- --nocapture

# Format code
fmt:
	cargo fmt

# Check formatting
fmt-check:
	cargo fmt -- --check

# Run clippy lints
clippy:
	cargo clippy -- -D warnings

# Clean build artifacts
clean:
	cargo clean

# Run in stdio mode (for development)
run-stdio:
	cargo run -- stdio --debug --api-key "$(HARNESS_API_KEY)" --account-id "$(HARNESS_ACCOUNT_ID)"

# Run in HTTP server mode (for development)
run-http:
	cargo run -- http-server --debug --port 8080 --api-key "$(HARNESS_API_KEY)" --account-id "$(HARNESS_ACCOUNT_ID)"

# Run in internal mode (for development)
run-internal:
	cargo run -- internal --debug --port 8080 --bearer-token "$(HARNESS_BEARER_TOKEN)" --mcp-svc-secret "$(HARNESS_MCP_SVC_SECRET)"

# Install the binary
install:
	cargo install --path .

# Install development dependencies
dev-deps:
	rustup component add rustfmt clippy

# Run with specific log level
run-debug:
	RUST_LOG=debug cargo run -- stdio --debug --api-key "$(HARNESS_API_KEY)" --account-id "$(HARNESS_ACCOUNT_ID)"

# Check for security vulnerabilities
audit:
	cargo audit

# Generate documentation
docs:
	cargo doc --open

# Run benchmarks (if any)
bench:
	cargo bench

# Docker build
docker-build:
	docker build -t harness-mcp-server:latest .

# Docker run
docker-run:
	docker run -it --rm \
		-e HARNESS_API_KEY="$(HARNESS_API_KEY)" \
		-e HARNESS_ACCOUNT_ID="$(HARNESS_ACCOUNT_ID)" \
		harness-mcp-server:latest stdio --debug

# Help target
help:
	@echo "Available targets:"
	@echo "  build        - Build the project in release mode"
	@echo "  build-dev    - Build the project in development mode"
	@echo "  test         - Run tests"
	@echo "  test-verbose - Run tests with output"
	@echo "  fmt          - Format code"
	@echo "  fmt-check    - Check code formatting"
	@echo "  clippy       - Run clippy lints"
	@echo "  clean        - Clean build artifacts"
	@echo "  run-stdio    - Run in stdio mode (requires HARNESS_API_KEY and HARNESS_ACCOUNT_ID)"
	@echo "  run-http     - Run in HTTP server mode"
	@echo "  run-internal - Run in internal mode"
	@echo "  install      - Install the binary"
	@echo "  dev-deps     - Install development dependencies"
	@echo "  audit        - Check for security vulnerabilities"
	@echo "  docs         - Generate and open documentation"
	@echo "  docker-build - Build Docker image"
	@echo "  docker-run   - Run Docker container"
	@echo "  help         - Show this help message"