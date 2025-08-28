# Go to Rust Dependency Migration Mapping

## Core Dependencies Mapping

### CLI and Configuration
| Go Package | Rust Equivalent | Purpose | Status |
|------------|-----------------|---------|--------|
| `github.com/spf13/cobra v1.8.0` | `clap = { version = "4.0", features = ["derive", "env"] }` | CLI framework | ✅ Migrated |
| `github.com/spf13/viper v1.18.2` | `config = "0.14"` | Configuration management | ✅ Migrated |

### HTTP and Networking
| Go Package | Rust Equivalent | Purpose | Status |
|------------|-----------------|---------|--------|
| `github.com/hashicorp/go-retryablehttp v0.7.1` | `reqwest = { version = "0.12", features = ["json", "stream"] }` + `backoff = "0.4"` | HTTP client with retry | ✅ Migrated |
| `github.com/oapi-codegen/runtime v1.1.1` | `reqwest` + custom OpenAPI handling | OpenAPI runtime | ✅ Migrated |

### Serialization and Data
| Go Package | Rust Equivalent | Purpose | Status |
|------------|-----------------|---------|--------|
| `gopkg.in/yaml.v3 v3.0.1` | `serde_yaml = "0.9"` | YAML processing | ✅ Migrated |
| JSON handling (built-in) | `serde_json = "1.0"` | JSON serialization | ✅ Migrated |
| - | `serde = { version = "1.0", features = ["derive"] }` | Serialization framework | ✅ Added |

### Authentication and Security
| Go Package | Rust Equivalent | Purpose | Status |
|------------|-----------------|---------|--------|
| `github.com/golang-jwt/jwt v3.2.2+incompatible` | `jsonwebtoken = "9.0"` | JWT handling | ✅ Migrated |

### Utilities
| Go Package | Rust Equivalent | Purpose | Status |
|------------|-----------------|---------|--------|
| `github.com/google/uuid v1.6.0` | `uuid = { version = "1.0", features = ["v4", "serde"] }` | UUID generation | ✅ Migrated |
| `github.com/cenkalti/backoff/v4 v4.3.0` | `backoff = "0.4"` | Exponential backoff | ✅ Migrated |

### Async Runtime and Concurrency
| Go Package | Rust Equivalent | Purpose | Status |
|------------|-----------------|---------|--------|
| Go runtime (goroutines) | `tokio = { version = "1.0", features = ["full"] }` | Async runtime | ✅ Migrated |
| Go channels | `tokio::sync::mpsc`, `futures = "0.3"` | Async communication | ✅ Migrated |

### Logging
| Go Package | Rust Equivalent | Purpose | Status |
|------------|-----------------|---------|--------|
| `github.com/rs/zerolog v1.34.0` | `tracing = "0.1"` | Structured logging | ✅ Migrated |
| `github.com/sirupsen/logrus v1.9.0` | `tracing-subscriber = { version = "0.3", features = ["env-filter"] }` | Log formatting | ✅ Migrated |

### Testing
| Go Package | Rust Equivalent | Purpose | Status |
|------------|-----------------|---------|--------|
| `github.com/stretchr/testify v1.10.0` | `tokio-test = "0.4"`, `mockito = "1.0"` | Testing framework | ✅ Migrated |

### Error Handling
| Go Package | Rust Equivalent | Purpose | Status |
|------------|-----------------|---------|--------|
| Go error interface | `anyhow = "1.0"`, `thiserror = "1.0"` | Error handling | ✅ Migrated |

### Time and Date
| Go Package | Rust Equivalent | Purpose | Status |
|------------|-----------------|---------|--------|
| Go time package | `chrono = { version = "0.4", features = ["serde"] }` | Date/time handling | ✅ Migrated |

### String and Text Processing
| Go Package | Rust Equivalent | Purpose | Status |
|------------|-----------------|---------|--------|
| Go strings package | `regex = "1.0"`, `inflector = "0.11"` | String manipulation | ✅ Migrated |

### File System and I/O
| Go Package | Rust Equivalent | Purpose | Status |
|------------|-----------------|---------|--------|
| Go os/filepath | `walkdir = "2.0"` | File system traversal | ✅ Migrated |
| Go embed | `include_str!()`, custom embed | Resource embedding | ✅ Migrated |

### Template Engine
| Go Package | Rust Equivalent | Purpose | Status |
|------------|-----------------|---------|--------|
| Go text/template | `handlebars = "5.0"` | Template processing | ✅ Migrated |

### Encoding
| Go Package | Rust Equivalent | Purpose | Status |
|------------|-----------------|---------|--------|
| Go encoding/base64 | `base64 = "0.22"` | Base64 encoding | ✅ Migrated |

### URL Processing
| Go Package | Rust Equivalent | Purpose | Status |
|------------|-----------------|---------|--------|
| Go net/url | `url = "2.0"` | URL parsing | ✅ Migrated |

### Environment Variables
| Go Package | Rust Equivalent | Purpose | Status |
|------------|-----------------|---------|--------|
| Go os.Getenv | `dotenv = "0.15"` | Environment handling | ✅ Migrated |

### Concurrent Data Structures
| Go Package | Rust Equivalent | Purpose | Status |
|------------|-----------------|---------|--------|
| Go sync.Map | `dashmap = "5.0"` | Concurrent hash map | ✅ Migrated |

### HTTP Status and Headers
| Go Package | Rust Equivalent | Purpose | Status |
|------------|-----------------|---------|--------|
| Go net/http | `http = "1.0"`, `hyper = { version = "1.0", features = ["full"] }` | HTTP utilities | ✅ Migrated |

## Harness-Specific Dependencies

### MCP Protocol
| Go Package | Rust Equivalent | Purpose | Status |
|------------|-----------------|---------|--------|
| `github.com/mark3labs/mcp-go v0.34.0` | Custom implementation using `serde_json` | MCP protocol | 🔄 Custom Implementation |

### Harness SDK
| Go Package | Rust Equivalent | Purpose | Status |
|------------|-----------------|---------|--------|
| `github.com/harness/harness-go-sdk v0.5.12` | Custom HTTP client using `reqwest` | Harness API integration | 🔄 Custom Implementation |

## Development Tools Migration

### Code Formatting
| Go Tool | Rust Equivalent | Purpose | Status |
|---------|-----------------|---------|--------|
| `goimports` | `rustfmt` | Code formatting | ✅ Built-in |
| `github.com/daixiang0/gci v0.13.7` | `rustfmt` | Import organization | ✅ Built-in |

### Build Tools
| Go Tool | Rust Equivalent | Purpose | Status |
|---------|-----------------|---------|--------|
| `go build` | `cargo build` | Build system | ✅ Built-in |
| `go test` | `cargo test` | Testing | ✅ Built-in |
| `go mod` | `cargo` | Dependency management | ✅ Built-in |

## Additional Rust-Specific Dependencies

### Async Traits
- `async-trait = "0.1"` - Enables async functions in traits

### Build Dependencies
- `chrono` (build-time) - For build timestamps in build.rs

## Migration Notes

1. **MCP Protocol**: The Go version uses `github.com/mark3labs/mcp-go`. In Rust, we implement the MCP protocol directly using `serde_json` for JSON-RPC handling.

2. **Harness SDK**: The Go version uses the official Harness Go SDK. In Rust, we implement direct HTTP API calls using `reqwest`.

3. **Error Handling**: Go's error interface is replaced with Rust's `Result<T, E>` type, using `anyhow` for error chaining and `thiserror` for custom error types.

4. **Async Programming**: Go's goroutines and channels are replaced with Rust's async/await and Tokio runtime.

5. **Memory Management**: Rust's ownership system eliminates the need for garbage collection, providing better performance and memory safety.

6. **Type Safety**: Rust's type system provides compile-time guarantees that Go's runtime checks provide.

## Performance Improvements

1. **Zero-cost abstractions**: Rust's abstractions have no runtime overhead
2. **Memory efficiency**: No garbage collector, precise memory control
3. **Compile-time optimizations**: Rust's compiler performs aggressive optimizations
4. **Async efficiency**: Tokio provides highly efficient async I/O

## Security Improvements

1. **Memory safety**: Rust prevents buffer overflows, use-after-free, etc.
2. **Thread safety**: Rust's type system prevents data races at compile time
3. **Type safety**: Stronger type system prevents many runtime errors