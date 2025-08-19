# Go to Rust Dependency Mapping

This document maps the Go dependencies used in the original Harness MCP Server to their Rust equivalents.

## Core Dependencies

| Go Package | Rust Crate | Purpose | Notes |
|------------|------------|---------|-------|
| `github.com/spf13/cobra` | `clap` (v4.0) | CLI framework | Clap provides derive macros for easier CLI definition |
| `github.com/spf13/viper` | `config` (v0.14) + `clap` env support | Configuration management | Combined approach using clap's env support and config crate |
| `github.com/mark3labs/mcp-go` | `jsonrpc-core` + `jsonrpc-stdio-server` | MCP protocol implementation | Custom implementation using JSON-RPC libraries |

## HTTP and Networking

| Go Package | Rust Crate | Purpose | Notes |
|------------|------------|---------|-------|
| `github.com/hashicorp/go-retryablehttp` | `reqwest` + `reqwest-retry` + `reqwest-middleware` | HTTP client with retry logic | Reqwest is the de facto HTTP client for Rust |
| `net/http` (stdlib) | `reqwest` + `axum` | HTTP client/server | Axum for server, reqwest for client |

## Authentication and Security

| Go Package | Rust Crate | Purpose | Notes |
|------------|------------|---------|-------|
| `github.com/golang-jwt/jwt` | `jsonwebtoken` (v9.0) | JWT token handling | Direct equivalent for JWT operations |

## Data Handling

| Go Package | Rust Crate | Purpose | Notes |
|------------|------------|---------|-------|
| `github.com/google/uuid` | `uuid` (v1.0) | UUID generation | Feature-equivalent with v4 and serde support |
| `gopkg.in/yaml.v3` | `serde_yaml` (v0.9) | YAML parsing | Part of the serde ecosystem |
| `encoding/json` (stdlib) | `serde_json` (v1.0) | JSON serialization | Standard Rust JSON library |

## Async and Concurrency

| Go Package | Rust Crate | Purpose | Notes |
|------------|------------|---------|-------|
| `context` (stdlib) | `tokio` context and cancellation | Context management | Tokio provides cancellation tokens and context |
| goroutines | `tokio` tasks | Concurrent execution | Tokio tasks are the Rust equivalent of goroutines |
| channels | `tokio::sync::mpsc` | Message passing | Tokio provides various channel types |

## Logging and Observability

| Go Package | Rust Crate | Purpose | Notes |
|------------|------------|---------|-------|
| `github.com/rs/zerolog` | `tracing` + `tracing-subscriber` | Structured logging | Tracing is the standard logging framework for async Rust |
| `log` (stdlib) | `tracing` | Basic logging | Tracing supersedes the log crate |
| `log/slog` (stdlib) | `tracing` | Structured logging | Tracing provides structured logging out of the box |

## Error Handling

| Go Package | Rust Crate | Purpose | Notes |
|------------|------------|---------|-------|
| `errors` (stdlib) | `anyhow` + `thiserror` | Error handling | Anyhow for error propagation, thiserror for custom errors |
| `fmt.Errorf` | `anyhow::bail!` or `thiserror` | Error creation | Multiple approaches depending on use case |

## Utilities and Helpers

| Go Package | Rust Crate | Purpose | Notes |
|------------|------------|---------|-------|
| `github.com/cenkalti/backoff/v4` | `backoff` (v0.4) | Exponential backoff | Direct equivalent with tokio support |
| `github.com/oapi-codegen/runtime` | `openapi` (v0.1) | OpenAPI runtime support | For API client generation |
| `strings` (stdlib) | Rust `std::string` | String manipulation | Built into Rust standard library |
| `fmt` (stdlib) | Rust `std::fmt` | String formatting | Built into Rust standard library |
| `io` (stdlib) | Rust `std::io` + `tokio::io` | I/O operations | Tokio provides async I/O |
| `os` (stdlib) | Rust `std::env` + `std::fs` | OS interaction | Built into Rust standard library |
| `syscall` (stdlib) | `signal-hook` + `signal-hook-tokio` | Signal handling | For graceful shutdown |

## Testing

| Go Package | Rust Crate | Purpose | Notes |
|------------|------------|---------|-------|
| `github.com/stretchr/testify` | `tokio-test` + `mockall` + `wiremock` | Testing framework | Multiple crates for different testing needs |
| `testing` (stdlib) | Built-in `#[test]` | Unit testing | Rust has built-in testing support |

## Harness-Specific

| Go Package | Rust Crate | Purpose | Notes |
|------------|------------|---------|-------|
| `github.com/harness/harness-go-sdk` | Custom implementation | Harness API client | Will need to implement API client using reqwest |

## Additional Rust-Specific Dependencies

These are Rust-specific crates that don't have direct Go equivalents but are needed for the implementation:

| Rust Crate | Purpose | Notes |
|------------|---------|-------|
| `serde` | Serialization framework | Core serialization library for Rust |
| `tokio` | Async runtime | Essential for async Rust applications |
| `tower` + `tower-http` | HTTP middleware | For building HTTP services with middleware |
| `chrono` | Date/time handling | Equivalent to Go's time package |
| `url` | URL parsing | For URL manipulation |
| `base64` | Base64 encoding | For encoding/decoding operations |
| `dotenvy` | Environment variables | For loading .env files |
| `tempfile` | Temporary files | For testing |

## Migration Strategy

1. **Direct Replacements**: Many Go packages have direct Rust equivalents (UUID, JWT, YAML, etc.)
2. **Ecosystem Differences**: Some Go packages are replaced by multiple Rust crates (HTTP client + retry + middleware)
3. **Built-in Features**: Some Go stdlib features are built into Rust (string manipulation, formatting)
4. **Async-First**: Rust implementation uses async/await throughout, requiring tokio ecosystem
5. **Type Safety**: Rust's type system provides additional safety that Go's runtime checks provided

## Key Architectural Changes

1. **Error Handling**: Go's `error` interface becomes Rust's `Result<T, E>` type
2. **Concurrency**: Go's goroutines and channels become Tokio tasks and channels
3. **Memory Management**: Rust's ownership system eliminates the need for garbage collection
4. **Type System**: Rust's stronger type system catches more errors at compile time
5. **Async Model**: Rust uses async/await instead of Go's goroutine model