# ---------------------------------------------------------#
#                   Build Harness image                    #
# ---------------------------------------------------------#
FROM --platform=$BUILDPLATFORM rust:1.70-alpine AS builder

# Setup working dir
WORKDIR /app

ARG TARGETOS
ARG TARGETARCH

# Install build dependencies
RUN apk add --no-cache musl-dev pkgconfig openssl-dev

# Copy dependency files first for better caching
COPY Cargo.toml Cargo.lock ./

# Create a dummy main.rs to build dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs

# Build dependencies
RUN cargo build --release && rm -rf src

# COPY the source code as the last step
COPY src ./src

# Build the application
RUN cargo build --release

### Pull CA Certs
FROM --platform=$BUILDPLATFORM alpine:latest AS cert-image

RUN apk --update add ca-certificates

# ---------------------------------------------------------#
#                   Create final image                     #
# ---------------------------------------------------------#
FROM alpine:3.21 AS final

# setup app dir and its content
WORKDIR /app
VOLUME /data

ENV XDG_CACHE_HOME=/data

COPY --from=builder /app/target/release/harness-mcp-server /app/harness-mcp-server
COPY --from=cert-image /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt

ENTRYPOINT [ "/app/harness-mcp-server"]
CMD ["stdio"]