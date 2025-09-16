# Multi-stage Docker build for Harness MCP Server (Rust)
# Stage 1: Build environment
FROM rust:1.75-slim as builder

# Install system dependencies for building
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy Cargo files for dependency caching
COPY Cargo.toml Cargo.lock ./
COPY crates/*/Cargo.toml ./crates/

# Create dummy source files to build dependencies
RUN mkdir -p src crates/harness-mcp-core/src crates/harness-mcp-config/src \
    crates/harness-mcp-auth/src crates/harness-mcp-client/src \
    crates/harness-mcp-tools/src crates/harness-mcp-modules/src

# Create dummy main.rs and lib.rs files
RUN echo "fn main() {}" > src/main.rs
RUN for crate in harness-mcp-core harness-mcp-config harness-mcp-auth \
    harness-mcp-client harness-mcp-tools harness-mcp-modules; do \
    echo "// dummy" > crates/$crate/src/lib.rs; done

# Build dependencies (this layer will be cached)
RUN cargo build --release
RUN rm -rf src crates/*/src

# Copy actual source code
COPY src ./src
COPY crates ./crates

# Build the actual application
RUN cargo build --release --bin harness-mcp-server

# Stage 2: Runtime environment
FROM debian:bookworm-slim as runtime

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r harness && useradd -r -g harness harness

# Set working directory
WORKDIR /app

# Copy the binary from builder stage
COPY --from=builder /app/target/release/harness-mcp-server /usr/local/bin/harness-mcp-server

# Create directories for logs and configuration
RUN mkdir -p /app/logs /app/config && \
    chown -R harness:harness /app

# Switch to non-root user
USER harness

# Expose port for HTTP transport (if used)
EXPOSE 8080

# Set environment variables
ENV RUST_LOG=info
ENV HARNESS_MCP_MODE=stdio
ENV HARNESS_MCP_LOG_LEVEL=info

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD if [ "$HARNESS_MCP_MODE" = "http" ]; then \
        curl -f http://localhost:8080/health || exit 1; \
    else \
        echo "Health check not applicable for stdio mode"; \
    fi

# Default command
ENTRYPOINT ["harness-mcp-server"]
CMD ["--mode", "stdio"]