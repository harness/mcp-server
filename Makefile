# Rust-based Makefile for harness-mcp-server

###############################################################################
#
# Build rules
#
###############################################################################

build: ## Build the mcp-server binary
	@echo "Building mcp-server"
	cargo build --release

build-dev: ## Build the mcp-server binary in debug mode
	@echo "Building mcp-server (debug)"
	cargo build

###############################################################################
#
# Code Formatting and linting
#
###############################################################################

format: ## Format Rust code
	@echo "Formatting ..."
	@cargo fmt
	@echo "Formatting complete"

lint: ## Run clippy linter
	@echo "Running clippy ..."
	@cargo clippy -- -D warnings
	@echo "Linting complete"

check: ## Check code without building
	@echo "Checking code ..."
	@cargo check
	@echo "Check complete"

###############################################################################
#
# Testing
#
###############################################################################

test: ## Run the Rust tests
	@echo "Running tests"
	@cargo test

test-e2e: ## Run end-to-end tests
	@echo "Running E2E tests"
	@cargo test --features e2e

###############################################################################
#
# Docker
#
###############################################################################

docker-build: ## Build Docker image
	@echo "Building Docker image"
	@docker build -t harness-mcp-server .

docker-run: ## Run Docker container
	@echo "Running Docker container"
	@docker run -it --rm harness-mcp-server

###############################################################################
#
# Cleanup
#
###############################################################################

clean: ## Clean build artifacts
	@echo "Cleaning ..."
	@cargo clean
	@echo "Clean complete"

.PHONY: help format lint check test test-e2e build build-dev docker-build docker-run clean

help: ## show help message
	@awk 'BEGIN {FS = ":.*##"; printf "\\nUsage:\\n  make \\033[36m\\033[0m\\n"} /^[$$()% 0-9a-zA-Z_-]+:.*?##/ { printf "  \\033[36m%-15s\\033[0m %s\\n", $$1, $$2 } /^##@/ { printf "\\n\\033[1m%s\\033[0m\\n", substr($$0, 5) } ' $(MAKEFILE_LIST)