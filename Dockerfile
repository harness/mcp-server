# ---------------------------------------------------------#
#                   Build Harness image                    #
# ---------------------------------------------------------#
FROM --platform=$BUILDPLATFORM golang:1.24.3-alpine AS builder

# Setup working dir
WORKDIR /app

# Get dependencies - will also be cached if we won't change mod/sum
COPY go.mod .
COPY go.sum .
RUN go mod download

# COPY the source code as the last step
COPY . .

# set required build flags
RUN --mount=type=cache,target=/root/.cache/go-build \
    --mount=type=cache,target=/go/pkg \
    CGO_ENABLED=0 \
    GOOS=$TARGETOS GOARCH=$TARGETARCH \
    go build -ldflags="-s -w" -o ./cmd/harness-mcp-server/harness-mcp-server ./cmd/harness-mcp-server

### Pull CA Certs
FROM --platform=$BUILDPLATFORM alpine:latest AS cert-image

RUN apk --update add ca-certificates

# ---------------------------------------------------------#
#                   Create final image                     #
# ---------------------------------------------------------#
FROM alpine:3.21 AS final

# Install necessary runtime dependencies
RUN apk --no-cache add ca-certificates tzdata curl tini && \
    mkdir -p /app && \
    adduser -D -H -h /app mcp && \
    chown -R mcp:mcp /app

# setup app dir and its content
WORKDIR /app
# Create data directory before declaring it as a volume
RUN mkdir -p /data && chown -R mcp:mcp /data
VOLUME /data

ENV XDG_CACHE_HOME=/data

# Copy binary and certificates
COPY --from=builder /app/cmd/harness-mcp-server/harness-mcp-server /app/harness-mcp-server
COPY --from=cert-image /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt

# Set proper permissions
RUN chmod +x /app/harness-mcp-server

# Switch to non-root user
USER mcp

# Expose the HTTP port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/api/health || exit 1

# Run in HTTP mode by default - use shell to properly pass the transport flag
ENTRYPOINT ["/sbin/tini", "--", "/app/harness-mcp-server", "server", "--transport=http"]