# Go to Rust Dependency Mapping

This document maps Go dependencies from the original `go.mod` to equivalent Rust crates in `Cargo.toml`.

## Direct Mappings

| Go Package | Rust Crate | Purpose | Notes |
|------------|------------|---------|-------|
| `github.com/spf13/cobra` | `clap` | CLI framework | Rust clap provides similar derive-based CLI |
| `github.com/spf13/viper` | `config` | Configuration management | Rust config crate handles multiple formats |
| `github.com/golang-jwt/jwt` | `jsonwebtoken` | JWT authentication | Direct equivalent functionality |
| `github.com/google/uuid` | `uuid` | UUID generation | Direct equivalent |
| `github.com/cenkalti/backoff/v4` | `backoff` | Retry logic | Similar exponential backoff |
| `github.com/hashicorp/go-retryablehttp` | `reqwest` + `backoff` | HTTP client with retries | Combined functionality |
| Go `net/http` | `reqwest` + `hyper` | HTTP client/server | Reqwest for client, hyper for server |
| Go `encoding/json` | `serde_json` | JSON serialization | Serde ecosystem |
| Go `log/slog` | `tracing` | Structured logging | More powerful than Go's slog |
| Go `time` | `chrono` | Date/time handling | More feature-rich |
| Go `context` | `tokio` cancellation | Context cancellation | Built into async runtime |

## Packages Requiring Implementation

| Go Package | Status | Implementation Plan |
|------------|--------|-------------------|
| `github.com/mark3labs/mcp-go` | **Needs Implementation** | Create Rust MCP protocol implementation |
| `github.com/harness/harness-go-sdk` | **Needs Implementation** | Implement Harness API client using reqwest |
| `github.com/oapi-codegen/runtime` | **Alternative Approach** | Use manual API client implementation |

## Additional Rust Crates Added

| Crate | Purpose | Why Added |
|-------|---------|-----------|
| `tokio` | Async runtime | Required for async/await |
| `async-trait` | Async traits | Enables async trait methods |
| `futures` | Async utilities | Stream and future combinators |
| `tower` + `tower-http` | HTTP middleware | Service abstraction and HTTP middleware |
| `anyhow` + `thiserror` | Error handling | Better error ergonomics than Go |
| `tracing-subscriber` | Logging setup | Configurable logging |
| `url` | URL parsing | Better than Go's net/url |
| `base64` | Base64 encoding | Common encoding needs |
| `bytes` | Efficient byte handling | Zero-copy byte operations |

## Go Standard Library Mappings

| Go Package | Rust Equivalent | Notes |
|------------|-----------------|-------|
| `fmt` | `std::fmt` + `format!` macro | Built into language |
| `io` | `std::io` | Similar abstractions |
| `os` | `std::env` + `std::fs` | Split across modules |
| `strings` | `String` methods | Built into String type |
| `strconv` | `str::parse()` + `ToString` | Built into language |
| `sync` | `std::sync` + `tokio::sync` | Sync + async primitives |
| `regexp` | `regex` | More powerful regex engine |

## Migration Notes

### MCP Protocol Implementation
The original Go code uses `github.com/mark3labs/mcp-go` for the Model Context Protocol. This needs to be implemented in Rust, including:
- JSON-RPC 2.0 transport
- MCP message types and schemas
- Tool and resource abstractions
- Server and client implementations

### Harness API Client
The `github.com/harness/harness-go-sdk` provides generated API clients. In Rust, we'll implement:
- Manual API client using `reqwest`
- Proper authentication handling
- Request/response types
- Service-specific client modules

### Error Handling
Go's error handling (`error` interface, multiple return values) maps to Rust's `Result<T, E>` type:
- `func() (T, error)` → `async fn() -> Result<T, Error>`
- Error wrapping and context preservation
- Custom error types using `thiserror`

### Concurrency
Go's goroutines and channels map to Rust's async/await:
- `go func()` → `tokio::spawn(async move {})`
- `chan T` → `tokio::sync::mpsc::channel<T>()`
- `select` → `tokio::select!`

### Configuration
Go's Viper configuration maps to Rust's config crate:
- Environment variable binding
- Multiple configuration sources
- Type-safe configuration structs