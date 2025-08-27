# Go to Rust Dependency Mapping

This document maps Go dependencies used in the original Harness MCP Server to their Rust equivalents.

## Core Dependencies

| Go Package | Version | Rust Crate | Version | Purpose | Notes |
|------------|---------|------------|---------|---------|-------|
| `github.com/mark3labs/mcp-go` | v0.34.0 | **TBD** | - | MCP protocol implementation | No direct Rust equivalent yet - need to implement MCP protocol |
| `github.com/harness/harness-go-sdk` | v0.5.12 | **Custom** | - | Harness API SDK | Will implement custom HTTP client for Harness APIs |
| `github.com/spf13/cobra` | v1.8.0 | `clap` | 4.5 | CLI framework | Rust's most popular CLI library with derive macros |
| `github.com/spf13/viper` | v1.18.2 | `config` + `serde` | 0.14 + 1.0 | Configuration management | Combined approach with config crate and serde |
| `github.com/google/uuid` | v1.6.0 | `uuid` | 1.10 | UUID generation | Direct equivalent with v4 and serde features |
| `github.com/golang-jwt/jwt` | v3.2.2 | `jsonwebtoken` | 9.3 | JWT token handling | Popular Rust JWT library |

## HTTP & Networking

| Go Package | Version | Rust Crate | Version | Purpose | Notes |
|------------|---------|------------|---------|---------|-------|
| `github.com/hashicorp/go-retryablehttp` | v0.7.1 | `reqwest` + `backoff` | 0.12 + 0.4 | HTTP client with retry | reqwest for HTTP, backoff for retry logic |
| `github.com/oapi-codegen/runtime` | v1.1.1 | `reqwest` + `serde` | 0.12 + 1.0 | OpenAPI runtime | Manual implementation with reqwest and serde |
| `github.com/cenkalti/backoff/v4` | v4.3.0 | `backoff` | 0.4 | Exponential backoff | Direct equivalent |

## Async Runtime & Concurrency

| Go Feature | Rust Equivalent | Version | Purpose | Notes |
|------------|-----------------|---------|---------|-------|
| Goroutines | `tokio` | 1.40 | Async runtime | Tokio provides async/await and task spawning |
| Channels | `tokio::sync::mpsc` | 1.40 | Message passing | Built into tokio |
| Context | `tokio::select!` + `CancellationToken` | 1.40 | Cancellation | Tokio provides cancellation mechanisms |

## JSON & Serialization

| Go Package | Version | Rust Crate | Version | Purpose | Notes |
|------------|---------|------------|---------|---------|-------|
| `encoding/json` | stdlib | `serde_json` | 1.0 | JSON serialization | Rust's standard JSON library |
| `gopkg.in/yaml.v3` | v3.0.1 | `serde_yaml` | 0.9 | YAML serialization | For configuration files |

## Error Handling

| Go Pattern | Rust Equivalent | Version | Purpose | Notes |
|------------|-----------------|---------|---------|-------|
| `error` interface | `thiserror` + `anyhow` | 1.0 + 1.0 | Error handling | thiserror for custom errors, anyhow for error chains |
| Error wrapping | `anyhow::Context` | 1.0 | Error context | Provides error context and chaining |

## Logging & Observability

| Go Package | Version | Rust Crate | Version | Purpose | Notes |
|------------|---------|------------|---------|---------|-------|
| `log/slog` | stdlib | `tracing` | 0.1 | Structured logging | More powerful than Go's slog |
| Log formatting | stdlib | `tracing-subscriber` | 0.3 | Log formatting | JSON and text formatters |

## Testing

| Go Package | Version | Rust Crate | Version | Purpose | Notes |
|------------|---------|------------|---------|---------|-------|
| `github.com/stretchr/testify` | v1.10.0 | Built-in + `tokio-test` | - + 0.4 | Testing framework | Rust has built-in testing, tokio-test for async |
| `testing` | stdlib | Built-in | - | Unit testing | Rust has excellent built-in testing |

## Development Tools

| Go Tool | Rust Equivalent | Purpose | Notes |
|---------|-----------------|---------|-------|
| `goimports` | `rustfmt` | Code formatting | Built into Rust toolchain |
| `github.com/daixiang0/gci` | `rustfmt` | Import organization | Handled by rustfmt |
| `go vet` | `clippy` | Linting | Rust's official linter |
| `go mod` | `cargo` | Dependency management | Rust's package manager |

## Time & Date

| Go Package | Version | Rust Crate | Version | Purpose | Notes |
|------------|---------|------------|---------|---------|-------|
| `time` | stdlib | `chrono` | 0.4 | Date/time handling | More feature-rich than Go's time |

## Utilities

| Go Package | Version | Rust Crate | Version | Purpose | Notes |
|------------|---------|------------|---------|---------|-------|
| `strings` | stdlib | Built-in | - | String manipulation | Rust has excellent built-in string handling |
| `fmt` | stdlib | `format!` macro | - | String formatting | Rust's formatting is compile-time checked |
| `context` | stdlib | `tokio::select!` | 1.40 | Cancellation | Tokio provides cancellation |
| `sync` | stdlib | `tokio::sync` | 1.40 | Synchronization | Async-aware synchronization primitives |

## Additional Rust-Specific Crates

These crates don't have direct Go equivalents but provide valuable functionality:

| Crate | Version | Purpose | Notes |
|-------|---------|---------|-------|
| `tower` | 0.5 | Service abstraction | Middleware and service composition |
| `tower-http` | 0.6 | HTTP middleware | CORS, tracing, etc. |
| `axum` | 0.7 | Web framework | For potential HTTP server mode |
| `url` | 2.5 | URL parsing | More robust than Go's url package |
| `base64` | 0.22 | Base64 encoding | Direct equivalent |
| `dotenvy` | 0.15 | Environment variables | For .env file support |

## Migration Strategy

1. **Phase 1**: Core infrastructure (HTTP client, error handling, configuration)
2. **Phase 2**: MCP protocol implementation (custom, as no Rust library exists)
3. **Phase 3**: Tool implementations (connectors, pipelines, etc.)
4. **Phase 4**: Advanced features (modules, licensing, etc.)

## Key Differences

1. **Memory Management**: Rust's ownership system eliminates the need for garbage collection
2. **Error Handling**: Rust's `Result<T, E>` type provides compile-time error checking
3. **Concurrency**: Rust's async/await is more explicit than Go's goroutines
4. **Type Safety**: Rust's type system is more strict, catching errors at compile time
5. **Performance**: Rust typically offers better performance due to zero-cost abstractions

## Notes

- **MCP Protocol**: No existing Rust MCP library found. Will need to implement JSON-RPC 2.0 protocol manually.
- **Harness SDK**: Will implement custom HTTP client instead of using official SDK.
- **Testing**: Rust's built-in testing is more powerful than Go's, with better integration testing support.
- **Documentation**: Rust's documentation system (rustdoc) is more integrated than Go's.