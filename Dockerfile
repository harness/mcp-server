# ---------------------------------------------------------#
#                   Build Harness image                    #
# ---------------------------------------------------------#
FROM --platform=$BUILDPLATFORM harness0.harness.io/oci/docker_artifacts/golang:1.24.3-alpine AS builder

# Setup workig dir
WORKDIR /app

ARG TARGETOS
ARG TARGETARCH

# Get dependencies - will also be cached if we won't change mod/sum
COPY go.mod .
COPY go.sum .

# COPY the source code as the last step
COPY . .

# set required build flags
RUN --mount=type=cache,target=/root/.cache/go-build \
    --mount=type=cache,target=/go/pkg \
    CGO_ENABLED=0 \
    GOOS=$TARGETOS GOARCH=$TARGETARCH \
    go build -o ./cmd/harness-mcp-server/harness-mcp-server ./cmd/harness-mcp-server

### Pull CA Certs
FROM --platform=$BUILDPLATFORM harness0.harness.io/oci/docker_artifacts/alpine:latest AS cert-image

RUN apk --update add ca-certificates

# ---------------------------------------------------------#
#                   Create final image                     #
# ---------------------------------------------------------#
FROM harness0.harness.io/oci/docker_artifacts/alpine:3.21 AS final

# setup app dir and its content
WORKDIR /app
VOLUME /data

ENV XDG_CACHE_HOME=/data

COPY --from=builder /app/cmd/harness-mcp-server/harness-mcp-server /app/harness-mcp-server
COPY --from=cert-image /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt

ENTRYPOINT [ "/app/harness-mcp-server"]
CMD ["stdio"]