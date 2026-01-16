# ---------------------------------------------------------#
#                   Build Harness image                    #
# ---------------------------------------------------------#
FROM --platform=$BUILDPLATFORM golang:1.25.1 AS builder

# Setup working dir
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
    go build -o mcp-server ./cmd/harness-mcp-server

# ---------------------------------------------------------#
#                   Create final image                     #
# ---------------------------------------------------------#
# Using Red Hat UBI for FIPS 140-2 compliance (Federal/DoD)
FROM registry.access.redhat.com/ubi9/ubi-minimal:latest AS final

RUN microdnf install -y ca-certificates && microdnf clean all

# setup app dir and its content
WORKDIR /app
VOLUME /data

ENV XDG_CACHE_HOME=/data
ENV GODEBUG="fips140=only"

COPY --from=builder /app/mcp-server /app/mcp-server

ENTRYPOINT ["/app/mcp-server"]
CMD ["stdio"]
