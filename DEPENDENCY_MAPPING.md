# Go to Rust Dependency Mapping

This document maps the Go dependencies from the original project to their Rust equivalents.

## Core Dependencies

### MCP Framework
- **Go**: `github.com/mark3labs/mcp-go v0.34.0`
- **Rust**: Custom implementation (no direct equivalent available)
- **Status**: ✅ Implemented basic MCP types and server structure
- **Notes**: We've created our own MCP protocol implementation in `src/types/mcp.rs`

### HTTP Client
- **Go**: `github.com/hashicorp/go-retryablehttp v0.7.1`
- **Rust**: `reqwest = { version = "0.11", features = ["json", "rustls-tls"] }`
- **Status**: ✅ Added to Cargo.toml
- **Notes**: reqwest provides async HTTP client with built-in retry capabilities via `backoff` crate

### CLI Framework
- **Go**: `github.com/spf13/cobra v1.8.0`
- **Rust**: `clap = { version = "4.0", features = ["derive", "env"] }`
- **Status**: ✅ Implemented in main.rs
- **Notes**: Clap provides similar functionality with derive macros for easier CLI definition

### Configuration Management
- **Go**: `github.com/spf13/viper v1.18.2`
- **Rust**: `config = "0.13"` + `serde = { version = "1.0", features = ["derive"] }`
- **Status**: ✅ Implemented in src/config/mod.rs
- **Notes**: Combined config crate with serde for configuration management

### Serialization
- **Go**: Built-in `encoding/json` + `gopkg.in/yaml.v3 v3.0.1`
- **Rust**: `serde_json = "1.0"` + `serde_yaml = "0.9"`
- **Status**: ✅ Added to Cargo.toml
- **Notes**: Serde ecosystem provides comprehensive serialization support

### UUID Generation
- **Go**: `github.com/google/uuid v1.6.0`
- **Rust**: `uuid = { version = "1.0", features = ["v4", "serde"] }`
- **Status**: ✅ Added to Cargo.toml
- **Notes**: Direct equivalent with serde support

### JWT Handling
- **Go**: `github.com/golang-jwt/jwt v3.2.2+incompatible`
- **Rust**: `jsonwebtoken = "9.0"`
- **Status**: ✅ Added to Cargo.toml
- **Notes**: Popular Rust JWT library with similar API

### Retry Logic
- **Go**: `github.com/cenkalti/backoff/v4 v4.3.0`
- **Rust**: `backoff = { version = "0.4", features = ["tokio"] }`
- **Status**: ✅ Added to Cargo.toml
- **Notes**: Tokio-compatible backoff implementation

### Async Runtime
- **Go**: Built-in goroutines
- **Rust**: `tokio = { version = "1.0", features = ["full"] }`
- **Status**: ✅ Implemented throughout the codebase
- **Notes**: Tokio provides async runtime, I/O, and utilities

### Error Handling
- **Go**: Built-in error interface + error wrapping
- **Rust**: `anyhow = "1.0"` + `thiserror = "1.0"`
- **Status**: ✅ Added to Cargo.toml
- **Notes**: anyhow for application errors, thiserror for library errors

### Logging
- **Go**: `log/slog` (built-in)
- **Rust**: `tracing = "0.1"` + `tracing-subscriber = { version = "0.3", features = ["env-filter", "json"] }`
- **Status**: ✅ Implemented in main.rs
- **Notes**: Tracing provides structured logging with async support

### Time Handling
- **Go**: Built-in `time` package
- **Rust**: `chrono = { version = "0.4", features = ["serde"] }`
- **Status**: ✅ Added to Cargo.toml
- **Notes**: Chrono is the standard Rust datetime library

### Base64 Encoding
- **Go**: Built-in `encoding/base64`
- **Rust**: `base64 = "0.21"`
- **Status**: ✅ Added to Cargo.toml
- **Notes**: Direct equivalent functionality

### Environment Variables
- **Go**: Built-in `os` package
- **Rust**: `dotenvy = "0.15"`
- **Status**: ✅ Added to Cargo.toml
- **Notes**: For .env file support, std::env for basic env vars

## HTTP Server Dependencies

### HTTP Server Framework
- **Go**: Built-in `net/http`
- **Rust**: `hyper = { version = "0.14", features = ["full"] }` + `tower = { version = "0.4", features = ["full"] }`
- **Status**: ✅ Added to Cargo.toml
- **Notes**: Hyper for HTTP, Tower for middleware and service composition

### HTTP Utilities
- **Go**: Various HTTP utilities
- **Rust**: `tower-http = { version = "0.4", features = ["full"] }`
- **Status**: ✅ Added to Cargo.toml
- **Notes**: Provides middleware, CORS, compression, etc.

### URL Handling
- **Go**: Built-in `net/url`
- **Rust**: `url = "2.0"`
- **Status**: ✅ Added to Cargo.toml
- **Notes**: Standard URL parsing and manipulation

## Harness-Specific Dependencies

### Harness Go SDK
- **Go**: `github.com/harness/harness-go-sdk v0.5.12`
- **Rust**: Custom implementation using `reqwest`
- **Status**: 🚧 Partially implemented in src/client/mod.rs
- **Notes**: Need to implement Harness API client from scratch

### OpenAPI Runtime
- **Go**: `github.com/oapi-codegen/runtime v1.1.1`
- **Rust**: Custom implementation or code generation
- **Status**: ❌ Not yet implemented
- **Notes**: May need to generate Rust client code from OpenAPI specs

## Testing Dependencies

### Testing Framework
- **Go**: `github.com/stretchr/testify v1.10.0`
- **Rust**: Built-in `#[cfg(test)]` + `tokio-test = "0.4"` + `mockito = "1.0"`
- **Status**: ✅ Added to Cargo.toml (dev-dependencies)
- **Notes**: Rust has built-in testing, tokio-test for async tests, mockito for HTTP mocking

### Temporary Files
- **Go**: Built-in `os` package
- **Rust**: `tempfile = "3.0"`
- **Status**: ✅ Added to Cargo.toml (dev-dependencies)
- **Notes**: For creating temporary files in tests

## Build and Development Dependencies

### Code Formatting
- **Go**: `github.com/daixiang0/gci v0.13.7` + `goimports`
- **Rust**: Built-in `cargo fmt` + `cargo clippy`
- **Status**: ✅ Available via Cargo
- **Notes**: Rust has excellent built-in tooling

### Build Tools
- **Go**: `golang.org/x/tools v0.24.0`
- **Rust**: Built-in Cargo
- **Status**: ✅ Implemented via Cargo.toml
- **Notes**: Cargo provides comprehensive build management

## Migration Status Summary

| Category | Go Dependencies | Rust Equivalents | Status |
|----------|----------------|------------------|---------|
| MCP Framework | mark3labs/mcp-go | Custom implementation | ✅ Basic structure |
| HTTP Client | go-retryablehttp | reqwest + backoff | ✅ Complete |
| CLI | cobra + viper | clap + config | ✅ Complete |
| Serialization | json + yaml | serde ecosystem | ✅ Complete |
| Async Runtime | goroutines | tokio | ✅ Complete |
| Error Handling | error interface | anyhow + thiserror | ✅ Complete |
| Logging | slog | tracing | ✅ Complete |
| Testing | testify | built-in + tokio-test | ✅ Complete |
| Harness SDK | harness-go-sdk | Custom reqwest client | 🚧 In Progress |
| OpenAPI | oapi-codegen | TBD | ❌ Not Started |

## Key Differences and Considerations

### 1. Memory Management
- **Go**: Garbage collected
- **Rust**: Ownership system with compile-time memory safety
- **Impact**: Better performance and memory safety in Rust

### 2. Error Handling
- **Go**: Error values and explicit checking
- **Rust**: Result<T, E> type with ? operator
- **Impact**: More ergonomic error handling in Rust

### 3. Async Programming
- **Go**: Goroutines and channels
- **Rust**: async/await with futures
- **Impact**: More explicit async boundaries in Rust

### 4. Type Safety
- **Go**: Runtime type checking
- **Rust**: Compile-time type checking
- **Impact**: Catch more errors at compile time

### 5. Package Management
- **Go**: go.mod with module system
- **Rust**: Cargo.toml with crates.io ecosystem
- **Impact**: More mature package ecosystem in Rust

## Next Steps

1. ✅ Complete basic project structure
2. ✅ Implement core MCP types and server
3. 🚧 Implement Harness API client
4. ❌ Port tool implementations
5. ❌ Implement comprehensive error handling
6. ❌ Add comprehensive testing
7. ❌ Performance optimization
8. ❌ Documentation updates

## Performance Expectations

The Rust implementation should provide:
- **Lower memory usage**: No garbage collector overhead
- **Better performance**: Zero-cost abstractions and compile-time optimizations
- **Faster startup**: No runtime initialization overhead
- **Better resource utilization**: Precise memory management