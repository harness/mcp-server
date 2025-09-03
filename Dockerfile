# Multi-stage Dockerfile for Harness MCP Server (Rust)

# Build stage
FROM rust:1.75-slim as builder

# Install system dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy Cargo files
COPY Cargo.toml Cargo.lock ./

# Create a dummy main.rs to cache dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs

# Build dependencies (this layer will be cached)
RUN cargo build --release && rm -rf src

# Copy source code
COPY src ./src

# Build the application
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -r -s /bin/false harness

# Set working directory
WORKDIR /app

# Copy binary from builder stage
COPY --from=builder /app/target/release/harness-mcp-server /usr/local/bin/harness-mcp-server

# Make binary executable
RUN chmod +x /usr/local/bin/harness-mcp-server

# Change ownership to harness user
RUN chown -R harness:harness /app

# Switch to non-root user
USER harness

# Expose port (if running in HTTP mode)
EXPOSE 8080

# Set default command
ENTRYPOINT ["harness-mcp-server"]
CMD ["stdio"]

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD harness-mcp-server --version || exit 1

# Labels
LABEL maintainer="Harness Inc."
LABEL description="Harness MCP Server - Rust Implementation"
LABEL version="1.0.0"
LABEL org.opencontainers.image.source="https://github.com/harness/harness-mcp"
LABEL org.opencontainers.image.description="Model Context Protocol server for Harness platform integration"
LABEL org.opencontainers.image.licenses="Apache-2.0"