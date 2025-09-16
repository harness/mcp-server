#!/bin/bash

# Docker deployment script for Harness MCP Server
set -euo pipefail

# Configuration
IMAGE_NAME="harness-mcp-server"
IMAGE_TAG="${IMAGE_TAG:-latest}"
REGISTRY="${REGISTRY:-}"
MODE="${MODE:-stdio}"
PORT="${PORT:-8080}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
}

# Build the Docker image
build_image() {
    log_info "Building Docker image: ${IMAGE_NAME}:${IMAGE_TAG}"
    
    docker build \
        -t "${IMAGE_NAME}:${IMAGE_TAG}" \
        -f Dockerfile \
        .
    
    log_info "Docker image built successfully"
}

# Tag and push to registry (if specified)
push_image() {
    if [[ -n "${REGISTRY}" ]]; then
        local full_image="${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
        
        log_info "Tagging image for registry: ${full_image}"
        docker tag "${IMAGE_NAME}:${IMAGE_TAG}" "${full_image}"
        
        log_info "Pushing image to registry: ${full_image}"
        docker push "${full_image}"
        
        log_info "Image pushed successfully"
    else
        log_warn "No registry specified, skipping push"
    fi
}

# Run the container
run_container() {
    local container_name="harness-mcp-server-${MODE}"
    
    # Stop and remove existing container if it exists
    if docker ps -a --format 'table {{.Names}}' | grep -q "^${container_name}$"; then
        log_info "Stopping existing container: ${container_name}"
        docker stop "${container_name}" >/dev/null 2>&1 || true
        docker rm "${container_name}" >/dev/null 2>&1 || true
    fi
    
    log_info "Starting container: ${container_name} in ${MODE} mode"
    
    # Common environment variables
    local env_vars=(
        "-e" "RUST_LOG=${RUST_LOG:-info}"
        "-e" "HARNESS_MCP_MODE=${MODE}"
        "-e" "HARNESS_MCP_LOG_LEVEL=${HARNESS_MCP_LOG_LEVEL:-info}"
    )
    
    # Add Harness-specific environment variables if they exist
    if [[ -n "${HARNESS_API_KEY:-}" ]]; then
        env_vars+=("-e" "HARNESS_API_KEY=${HARNESS_API_KEY}")
    fi
    
    if [[ -n "${HARNESS_BASE_URL:-}" ]]; then
        env_vars+=("-e" "HARNESS_BASE_URL=${HARNESS_BASE_URL}")
    fi
    
    if [[ -n "${HARNESS_ACCOUNT_ID:-}" ]]; then
        env_vars+=("-e" "HARNESS_ACCOUNT_ID=${HARNESS_ACCOUNT_ID}")
    fi
    
    if [[ -n "${HARNESS_ORG_ID:-}" ]]; then
        env_vars+=("-e" "HARNESS_ORG_ID=${HARNESS_ORG_ID}")
    fi
    
    if [[ -n "${HARNESS_PROJECT_ID:-}" ]]; then
        env_vars+=("-e" "HARNESS_PROJECT_ID=${HARNESS_PROJECT_ID}")
    fi
    
    # Mode-specific configuration
    if [[ "${MODE}" == "http" ]]; then
        docker run -d \
            --name "${container_name}" \
            -p "${PORT}:8080" \
            "${env_vars[@]}" \
            -v "$(pwd)/logs:/app/logs" \
            -v "$(pwd)/config:/app/config" \
            --restart unless-stopped \
            "${IMAGE_NAME}:${IMAGE_TAG}" \
            --mode http --port 8080 --host 0.0.0.0
        
        log_info "Container started in HTTP mode on port ${PORT}"
        log_info "Health check: curl http://localhost:${PORT}/health"
    else
        docker run -d \
            --name "${container_name}" \
            "${env_vars[@]}" \
            -v "$(pwd)/logs:/app/logs" \
            -v "$(pwd)/config:/app/config" \
            --restart unless-stopped \
            "${IMAGE_NAME}:${IMAGE_TAG}" \
            --mode stdio
        
        log_info "Container started in stdio mode"
        log_info "View logs: docker logs -f ${container_name}"
    fi
}

# Show container status
show_status() {
    local container_name="harness-mcp-server-${MODE}"
    
    log_info "Container status:"
    docker ps --filter "name=${container_name}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    
    if [[ "${MODE}" == "http" ]]; then
        log_info "Testing health endpoint..."
        sleep 5  # Wait for container to start
        if curl -f "http://localhost:${PORT}/health" >/dev/null 2>&1; then
            log_info "Health check passed ✓"
        else
            log_warn "Health check failed - container may still be starting"
        fi
    fi
}

# Main function
main() {
    log_info "Starting Docker deployment for Harness MCP Server"
    log_info "Mode: ${MODE}, Port: ${PORT}, Image: ${IMAGE_NAME}:${IMAGE_TAG}"
    
    check_docker
    build_image
    
    if [[ "${1:-}" == "--push" ]]; then
        push_image
    fi
    
    run_container
    show_status
    
    log_info "Deployment completed successfully!"
}

# Help function
show_help() {
    cat << EOF
Docker deployment script for Harness MCP Server

Usage: $0 [OPTIONS] [--push]

Options:
    --help          Show this help message
    --push          Push image to registry after building

Environment Variables:
    IMAGE_TAG       Docker image tag (default: latest)
    REGISTRY        Docker registry URL (optional)
    MODE            Server mode: stdio or http (default: stdio)
    PORT            HTTP port when in http mode (default: 8080)
    RUST_LOG        Rust log level (default: info)
    
    Harness Configuration:
    HARNESS_API_KEY         Harness API key
    HARNESS_BASE_URL        Harness base URL (default: https://app.harness.io)
    HARNESS_ACCOUNT_ID      Harness account ID
    HARNESS_ORG_ID          Harness organization ID (optional)
    HARNESS_PROJECT_ID      Harness project ID (optional)

Examples:
    # Build and run in stdio mode
    $0
    
    # Build and run in HTTP mode
    MODE=http PORT=8080 $0
    
    # Build, push to registry, and run
    REGISTRY=my-registry.com $0 --push
    
    # Run with custom configuration
    MODE=http HARNESS_API_KEY=your-key HARNESS_ACCOUNT_ID=your-account $0

EOF
}

# Parse command line arguments
if [[ "${1:-}" == "--help" ]]; then
    show_help
    exit 0
fi

# Run main function
main "$@"