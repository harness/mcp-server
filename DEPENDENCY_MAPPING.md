# Go to Rust Dependency Mapping

This document maps Go dependencies from the original project to their Rust equivalents.

## Core Framework Dependencies

### MCP Protocol
| Go | Rust | Notes |
|---|---|---|
| `github.com/mark3labs/mcp-go v0.34.0` | **Custom Implementation** | No direct Rust equivalent available. Need to implement MCP protocol from scratch or find alternative. |

### CLI and Configuration
| Go | Rust | Notes |
|---|---|---|
| `github.com/spf13/cobra v1.8.0` | `clap = "4.4"` | Clap is the de facto standard for CLI in Rust |
| `github.com/spf13/viper v1.18.2` | `config = "0.14"` | Configuration management with multiple sources |

### HTTP Client and Server
| Go | Rust | Notes |
|---|---|---|
| `github.com/hashicorp/go-retryablehttp v0.7.1` | `reqwest = "0.11"` with retry middleware | Reqwest + custom retry logic |
| `github.com/oapi-codegen/runtime v1.1.1` | `openapi = "1.0"` or custom | OpenAPI runtime support |
| Standard `net/http` | `hyper = "0.14"` | Low-level HTTP implementation |

### Authentication and Security
| Go | Rust | Notes |
|---|---|---|
| `github.com/golang-jwt/jwt v3.2.2+incompatible` | `jsonwebtoken = "9.2"` | JWT handling |

### Serialization and Data
| Go | Rust | Notes |
|---|---|---|
| `encoding/json` | `serde_json = "1.0"` | JSON serialization |
| `gopkg.in/yaml.v3 v3.0.1` | `serde_yaml = "0.9"` | YAML processing |
| Standard serialization | `serde = "1.0"` | Core serialization framework |

### Utilities
| Go | Rust | Notes |
|---|---|---|
| `github.com/google/uuid v1.6.0` | `uuid = "1.6"` | UUID generation |
| `github.com/cenkalti/backoff/v4 v4.3.0` | `backoff = "0.4"` or custom | Exponential backoff |

### Async Runtime
| Go | Rust | Notes |
|---|---|---|
| Goroutines + channels | `tokio = "1.0"` | Async runtime and utilities |

### Error Handling
| Go | Rust | Notes |
|---|---|---|
| Standard `error` interface | `anyhow = "1.0"` | Error handling and context |
| Custom error types | `thiserror = "1.0"` | Derive macros for custom errors |

### Logging
| Go | Rust | Notes |
|---|---|---|
| `log/slog` | `tracing = "0.1"` | Structured logging |
| Log formatting | `tracing-subscriber = "0.3"` | Log formatting and filtering |

### Testing
| Go | Rust | Notes |
|---|---|---|
| `github.com/stretchr/testify v1.10.0` | Built-in `#[test]` + `tokio-test = "0.4"` | Testing framework |
| HTTP mocking | `mockito = "1.2"` | HTTP mocking for tests |

### Development Tools
| Go | Rust | Notes |
|---|---|---|
| `github.com/daixiang0/gci v0.13.7` | `cargo fmt` (built-in) | Code formatting |
| `golang.org/x/tools v0.24.0` | `cargo clippy` (built-in) | Linting and analysis |

## Harness-Specific Dependencies

### Harness SDK
| Go | Rust | Notes |
|---|---|---|
| `github.com/harness/harness-go-sdk v0.5.12` | **Custom Implementation** | Need to implement Harness API client in Rust |

## Additional Rust-Specific Dependencies

These are Rust-specific dependencies that don't have direct Go equivalents but are needed for idiomatic Rust development:

| Crate | Purpose | Version |
|---|---|---|
| `chrono` | Date and time handling | `0.4` |
| `url` | URL parsing and manipulation | `2.4` |
| `base64` | Base64 encoding/decoding | `0.21` |
| `signal-hook` | Signal handling | `0.3` |
| `signal-hook-tokio` | Async signal handling | `0.3` |
| `tempfile` | Temporary file handling (dev) | `3.8` |

## Migration Strategy

### 1. Direct Replacements
These dependencies have direct, well-established Rust equivalents:
- CLI: Cobra → Clap
- JSON: encoding/json → serde_json
- YAML: yaml.v3 → serde_yaml
- JWT: golang-jwt → jsonwebtoken
- UUID: google/uuid → uuid
- HTTP Client: go-retryablehttp → reqwest

### 2. Custom Implementation Required
These require custom implementation or finding alternative solutions:
- **MCP Protocol**: No Rust crate available, need to implement from scratch
- **Harness SDK**: Need to implement Harness API client in Rust
- **Configuration**: Viper has more features than config crate, may need custom solution

### 3. Architecture Changes
Some Go patterns need to be adapted to Rust:
- **Error Handling**: Go's error interface → Rust's Result type with thiserror
- **Concurrency**: Goroutines → Tokio tasks
- **Memory Management**: GC → Ownership system
- **Interfaces**: Go interfaces → Rust traits

## Implementation Notes

### MCP Protocol Implementation
Since there's no Rust MCP crate available, we need to:
1. Study the MCP protocol specification
2. Implement JSON-RPC 2.0 message handling
3. Create MCP-specific message types and handlers
4. Ensure compatibility with existing MCP clients

### Harness API Client
The Harness Go SDK needs to be reimplemented in Rust:
1. Study the existing Go SDK structure
2. Implement HTTP client with proper authentication
3. Create typed request/response structures
4. Implement retry logic and error handling
5. Add proper async support

### Configuration Management
Viper provides extensive configuration features. For Rust, we may need to:
1. Use the `config` crate as a base
2. Add environment variable support
3. Implement configuration file watching
4. Add configuration validation

### Error Handling Strategy
Rust's error handling is more explicit than Go's:
1. Use `Result<T, E>` for all fallible operations
2. Create custom error types with `thiserror`
3. Use `anyhow` for error context and chaining
4. Implement proper error propagation

### Async Runtime
All I/O operations should be async:
1. Use Tokio as the async runtime
2. Convert all HTTP operations to async
3. Use async/await for concurrent operations
4. Implement proper cancellation and timeouts

## Cargo.toml Dependencies Summary

```toml
[dependencies]
# CLI and configuration
clap = { version = "4.4", features = ["derive", "env"] }
config = "0.14"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
serde_yaml = "0.9"

# Async runtime and HTTP
tokio = { version = "1.0", features = ["full"] }
reqwest = { version = "0.11", features = ["json", "rustls-tls"], default-features = false }
hyper = { version = "0.14", features = ["full"] }

# Error handling and logging
anyhow = "1.0"
thiserror = "1.0"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter", "json"] }

# Authentication and security
jsonwebtoken = "9.2"

# Utilities
uuid = { version = "1.6", features = ["v4", "serde"] }
chrono = { version = "0.4", features = ["serde"] }
url = { version = "2.4", features = ["serde"] }
base64 = "0.21"

# Signal handling
signal-hook = "0.3"
signal-hook-tokio = { version = "0.3", features = ["futures-v0_3"] }

[dev-dependencies]
tokio-test = "0.4"
mockito = "1.2"
tempfile = "3.8"
```

This mapping provides a solid foundation for migrating the Go codebase to Rust while maintaining functionality and following Rust best practices.