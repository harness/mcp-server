# Go to Rust Dependency Mapping

This document maps Go dependencies from the original project to their Rust equivalents.

## Core Dependencies

| Go Package | Rust Crate | Version | Purpose | Notes |
|------------|------------|---------|---------|-------|
| `github.com/spf13/cobra` | `clap` | 4.0+ | CLI framework | Clap provides derive macros for easier CLI definition |
| `github.com/spf13/viper` | `config` + `dotenvy` | 0.14 + 0.15 | Configuration management | Combined approach: config for files, dotenvy for env vars |
| `github.com/mark3labs/mcp-go` | `jsonrpc-core` | 18.0 | MCP protocol | No direct Rust MCP lib, implementing JSON-RPC manually |
| `github.com/golang-jwt/jwt` | `jsonwebtoken` | 9.0 | JWT handling | Direct equivalent for JWT operations |
| `github.com/google/uuid` | `uuid` | 1.0 | UUID generation | Direct equivalent with v4 feature |
| `github.com/hashicorp/go-retryablehttp` | `backoff` + `reqwest` | 0.4 + 0.11 | HTTP with retry | Backoff for retry logic, reqwest for HTTP |
| `github.com/rs/zerolog` | `tracing` + `tracing-subscriber` | 0.1 + 0.3 | Structured logging | Tracing ecosystem is Rust standard |
| `github.com/stretchr/testify` | Built-in + `tokio-test` | - + 0.4 | Testing framework | Rust has built-in testing, tokio-test for async |

## HTTP and Networking

| Go Package | Rust Crate | Version | Purpose | Notes |
|------------|------------|---------|---------|-------|
| `net/http` | `reqwest` | 0.11 | HTTP client | Feature-rich async HTTP client |
| `github.com/hashicorp/go-cleanhttp` | `reqwest` defaults | - | Clean HTTP transport | Reqwest provides sensible defaults |
| `golang.org/x/net` | `reqwest` + `url` | 0.11 + 2.0 | Network utilities | Covered by reqwest and url crate |

## Serialization and Data

| Go Package | Rust Crate | Version | Purpose | Notes |
|------------|------------|---------|---------|-------|
| `encoding/json` | `serde_json` | 1.0 | JSON serialization | Part of serde ecosystem |
| `gopkg.in/yaml.v3` | `serde_yaml` | 0.9 | YAML serialization | Part of serde ecosystem |
| `github.com/apapsch/go-jsonmerge/v2` | `serde_json` + custom | 1.0 | JSON merging | Implement custom merge logic |

## Async and Concurrency

| Go Package | Rust Crate | Version | Purpose | Notes |
|------------|------------|---------|---------|-------|
| `context` | `tokio` context | 1.0 | Context/cancellation | Tokio provides cancellation tokens |
| `sync` | `tokio::sync` | 1.0 | Synchronization primitives | Async-aware sync primitives |
| `golang.org/x/sync` | `futures` + `tokio` | 0.3 + 1.0 | Extended sync utilities | Covered by tokio and futures |

## Error Handling

| Go Package | Rust Crate | Version | Purpose | Notes |
|------------|------------|---------|---------|-------|
| `errors` | `anyhow` + `thiserror` | 1.0 + 1.0 | Error handling | anyhow for app errors, thiserror for lib errors |
| `fmt.Errorf` | `anyhow::bail!` | 1.0 | Error creation | anyhow provides similar functionality |

## Time and Date

| Go Package | Rust Crate | Version | Purpose | Notes |
|------------|------------|---------|---------|-------|
| `time` | `chrono` | 0.4 | Time handling | Feature-rich time library |
| `golang.org/x/time` | `tokio::time` | 1.0 | Time utilities | Tokio provides async time utilities |

## Encoding and Crypto

| Go Package | Rust Crate | Version | Purpose | Notes |
|------------|------------|---------|---------|-------|
| `encoding/base64` | `base64` | 0.22 | Base64 encoding | Direct equivalent |
| `crypto/*` | `ring` + `rustls` | 0.17 + 0.21 | Cryptography | Modern crypto libraries |

## File System and I/O

| Go Package | Rust Crate | Version | Purpose | Notes |
|------------|------------|---------|---------|-------|
| `os` | `std::env` + `std::fs` | - | OS interface | Built into Rust standard library |
| `io` | `std::io` + `tokio::io` | - | I/O operations | Std for sync, tokio for async I/O |
| `path/filepath` | `std::path` | - | Path manipulation | Built into Rust standard library |

## Harness-Specific Dependencies

| Go Package | Rust Crate | Version | Purpose | Notes |
|------------|------------|---------|---------|-------|
| `github.com/harness/harness-go-sdk` | Custom implementation | - | Harness API client | Need to implement Rust client |
| `github.com/oapi-codegen/runtime` | `reqwest` + custom | 0.11 | OpenAPI runtime | Implement custom OpenAPI handling |

## Development and Build Tools

| Go Package | Rust Crate | Version | Purpose | Notes |
|------------|------------|---------|---------|-------|
| `github.com/daixiang0/gci` | `rustfmt` | - | Code formatting | Rust has built-in formatting |
| `golang.org/x/tools` | `cargo` ecosystem | - | Development tools | Cargo provides comprehensive tooling |

## Additional Rust-Specific Dependencies

These are Rust-specific crates that don't have direct Go equivalents but are needed for the Rust implementation:

| Rust Crate | Version | Purpose | Notes |
|------------|---------|---------|-------|
| `async-trait` | 0.1 | Async traits | Enables async functions in traits |
| `once_cell` | 1.0 | Lazy static initialization | For global state initialization |
| `futures` | 0.3 | Future utilities | Additional async utilities |

## Migration Strategy

1. **Phase 1**: Core infrastructure (CLI, config, logging, HTTP client)
2. **Phase 2**: MCP protocol implementation 
3. **Phase 3**: Authentication and session management
4. **Phase 4**: Tool implementations (pipelines, connectors, etc.)
5. **Phase 5**: Testing and validation

## Notes

- Rust's ownership system eliminates many memory safety issues present in Go
- Async/await in Rust requires explicit async runtime (tokio)
- Error handling in Rust is more explicit with Result types
- Serialization in Rust uses derive macros for better performance
- No direct MCP library for Rust exists, so we implement JSON-RPC manually