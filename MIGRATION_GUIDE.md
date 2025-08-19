# Harness MCP Server: Go to Rust Migration Guide

## Overview

This document provides a comprehensive guide for migrating the Harness MCP Server from Go to Rust. The migration maintains API compatibility while leveraging Rust's memory safety, performance, and modern async ecosystem.

## Migration Status

### ✅ Completed Components

1. **Project Structure & Dependencies**
   - Created Cargo.toml with all necessary Rust dependencies
   - Established modular project structure mirroring Go layout
   - Mapped all Go dependencies to Rust equivalents

2. **Core Infrastructure**
   - Configuration management (config module)
   - Authentication & JWT handling (auth module with jwt.rs, session.rs)
   - HTTP client utilities with retry logic (utils/http.rs)
   - Common types and data structures (types.rs)
   - Error handling with anyhow and thiserror

3. **Build System**
   - Rust Makefile (Makefile.rust) with development workflows
   - Cargo configuration for release optimization

### 🚧 In Progress Components

4. **MCP Protocol Implementation**
   - JSON-RPC server implementation
   - Tool registration and execution framework
   - Prompt handling system

5. **Tool Modules** (Partially Implemented)
   - Toolsets framework structure
   - Individual tool implementations (pipelines, connectors, dashboards, etc.)

### ⏳ Remaining Work

6. **Testing Framework**
   - Unit tests conversion
   - Integration tests
   - E2E test migration

7. **CI/CD Updates**
   - GitHub Actions for Rust
   - Docker image updates
   - Release automation

## Architecture Changes

### Key Differences from Go Implementation

| Aspect | Go | Rust |
|--------|----|----- |
| **Memory Management** | Garbage collected | Ownership system, zero-cost abstractions |
| **Error Handling** | Multiple return values | Result<T, E> type |
| **Async Runtime** | Built-in goroutines | Explicit tokio runtime |
| **JSON Handling** | encoding/json | serde ecosystem |
| **HTTP Client** | net/http | reqwest with async/await |
| **CLI Framework** | cobra/viper | clap with derive macros |
| **Logging** | zerolog | tracing ecosystem |

### Benefits of Rust Migration

1. **Memory Safety**: Eliminates entire classes of bugs (null pointer dereferences, buffer overflows)
2. **Performance**: Zero-cost abstractions and no garbage collection overhead
3. **Concurrency**: Fearless concurrency with ownership system preventing data races
4. **Type Safety**: Strong type system catches errors at compile time
5. **Ecosystem**: Modern async ecosystem with excellent HTTP and JSON libraries

## File Structure Mapping

```
Go Structure                 →  Rust Structure
├── cmd/                     →  src/
│   └── harness-mcp-server/  →      ├── main.rs
│       ├── main.go          →      └── lib.rs
│       └── config/          →  
├── pkg/                     →  src/
│   ├── harness/             →      ├── harness/
│   │   ├── auth/            →      │   ├── auth/
│   │   │   ├── auth.go      →      │   │   ├── mod.rs
│   │   │   ├── jwt.go       →      │   │   ├── jwt.rs
│   │   │   └── session.go   →      │   │   └── session.rs
│   │   ├── tools/           →      │   ├── tools/
│   │   ├── server.go        →      │   ├── server.rs
│   │   └── tools.go         →      │   └── mod.rs
│   ├── modules/             →      ├── modules/
│   ├── toolsets/            →      ├── toolsets/
│   └── utils/               →      └── utils/
├── go.mod                   →  Cargo.toml
├── Makefile                 →  Makefile.rust
└── test/                    →  tests/
```

## Dependency Migration

### Core Dependencies

| Go Package | Rust Crate | Purpose |
|------------|------------|---------|
| `github.com/spf13/cobra` | `clap` | CLI framework |
| `github.com/spf13/viper` | `config` + `dotenvy` | Configuration |
| `github.com/mark3labs/mcp-go` | `jsonrpc-core` | MCP protocol |
| `github.com/golang-jwt/jwt` | `jsonwebtoken` | JWT handling |
| `github.com/google/uuid` | `uuid` | UUID generation |
| `github.com/hashicorp/go-retryablehttp` | `backoff` + `reqwest` | HTTP with retry |
| `github.com/rs/zerolog` | `tracing` | Structured logging |

### New Rust-Specific Dependencies

- `tokio`: Async runtime
- `serde`: Serialization framework
- `anyhow`: Error handling
- `async-trait`: Async traits
- `chrono`: Date/time handling

## Implementation Patterns

### Error Handling

**Go Pattern:**
```go
func doSomething() (Result, error) {
    if err != nil {
        return nil, fmt.Errorf("operation failed: %w", err)
    }
    return result, nil
}
```

**Rust Pattern:**
```rust
fn do_something() -> Result<ResultType> {
    operation()
        .map_err(|e| anyhow!("operation failed: {}", e))?;
    Ok(result)
}
```

### Async Operations

**Go Pattern:**
```go
func (s *Server) handleRequest(ctx context.Context) error {
    result, err := s.client.Get(ctx, url)
    if err != nil {
        return err
    }
    return s.processResult(result)
}
```

**Rust Pattern:**
```rust
impl Server {
    async fn handle_request(&self) -> Result<()> {
        let result = self.client.get(url).await?;
        self.process_result(result).await
    }
}
```

### JSON Handling

**Go Pattern:**
```go
type Response struct {
    Data   interface{} `json:"data"`
    Status string      `json:"status"`
}

func parseResponse(data []byte) (*Response, error) {
    var resp Response
    err := json.Unmarshal(data, &resp)
    return &resp, err
}
```

**Rust Pattern:**
```rust
#[derive(Serialize, Deserialize)]
struct Response<T> {
    data: T,
    status: String,
}

fn parse_response<T>(data: &[u8]) -> Result<Response<T>>
where
    T: DeserializeOwned,
{
    Ok(serde_json::from_slice(data)?)
}
```

## Building and Running

### Prerequisites

1. Install Rust toolchain:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. Install required tools:
   ```bash
   rustup component add rustfmt clippy
   cargo install cargo-tarpaulin  # For test coverage
   ```

### Development Workflow

```bash
# Format code
make -f Makefile.rust format

# Run linter
make -f Makefile.rust lint

# Run tests
make -f Makefile.rust test

# Build debug version
make -f Makefile.rust build-dev

# Build release version
make -f Makefile.rust build

# Run the server
HARNESS_API_KEY=your_key cargo run -- stdio
```

### Docker Build

```dockerfile
FROM rust:1.70 as builder
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/harness-mcp-server /usr/local/bin/
ENTRYPOINT ["harness-mcp-server"]
```

## Testing Strategy

### Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use tokio_test;

    #[tokio::test]
    async fn test_authentication() {
        let auth = AuthSession::new("test_token").await;
        assert!(auth.is_ok());
    }
}
```

### Integration Tests

```rust
// tests/integration_test.rs
use harness_mcp_server::*;

#[tokio::test]
async fn test_pipeline_tools() {
    let config = Config::default();
    let server = HarnessServer::new(config).await.unwrap();
    // Test pipeline operations
}
```

## Performance Considerations

### Memory Usage

- **Go**: Garbage collection overhead, unpredictable memory usage
- **Rust**: Deterministic memory management, lower memory footprint

### Concurrency

- **Go**: Goroutines with potential race conditions
- **Rust**: Fearless concurrency with compile-time safety guarantees

### HTTP Performance

- **Go**: net/http with connection pooling
- **Rust**: reqwest with tokio, better async performance

## Migration Checklist

### Phase 1: Foundation ✅
- [x] Project structure setup
- [x] Dependency mapping
- [x] Core infrastructure (config, auth, utils)
- [x] Build system

### Phase 2: Core Implementation 🚧
- [ ] Complete MCP protocol implementation
- [ ] Toolsets framework
- [ ] Basic tool implementations

### Phase 3: Tool Migration ⏳
- [ ] Pipeline tools
- [ ] Connector tools
- [ ] Dashboard tools
- [ ] CCM tools
- [ ] Remaining tool modules

### Phase 4: Testing & Validation ⏳
- [ ] Unit test migration
- [ ] Integration tests
- [ ] E2E test conversion
- [ ] Performance benchmarks

### Phase 5: Deployment ⏳
- [ ] CI/CD pipeline updates
- [ ] Docker image migration
- [ ] Documentation updates
- [ ] Release process

## Troubleshooting

### Common Issues

1. **Async/Await Compilation Errors**
   - Ensure all async functions are properly awaited
   - Use `#[tokio::main]` for main function
   - Add `async-trait` for async trait methods

2. **Ownership/Borrowing Issues**
   - Use `.clone()` for simple types when needed
   - Consider `Arc<T>` for shared ownership
   - Use references (`&T`) when possible

3. **Serialization Errors**
   - Ensure all types implement `Serialize`/`Deserialize`
   - Use `#[serde(rename = "...")]` for field mapping
   - Handle optional fields with `Option<T>`

### Performance Optimization

1. **Release Builds**
   ```toml
   [profile.release]
   lto = true
   codegen-units = 1
   panic = "abort"
   ```

2. **Async Runtime Tuning**
   ```rust
   #[tokio::main(flavor = "multi_thread", worker_threads = 4)]
   async fn main() -> Result<()> {
       // Application code
   }
   ```

## Next Steps

1. **Complete MCP Implementation**: Finish the JSON-RPC server and tool framework
2. **Tool Migration**: Convert remaining tool modules systematically
3. **Testing**: Implement comprehensive test suite
4. **Performance Testing**: Benchmark against Go implementation
5. **Documentation**: Update all documentation for Rust version
6. **Deployment**: Set up CI/CD for Rust builds

## Resources

- [Rust Book](https://doc.rust-lang.org/book/)
- [Tokio Tutorial](https://tokio.rs/tokio/tutorial)
- [Serde Guide](https://serde.rs/)
- [Reqwest Documentation](https://docs.rs/reqwest/)
- [Clap Documentation](https://docs.rs/clap/)

## Conclusion

The migration to Rust provides significant benefits in terms of memory safety, performance, and maintainability. The foundation has been established with core infrastructure components completed. The remaining work involves systematic conversion of tool modules and comprehensive testing to ensure API compatibility and functionality parity with the Go implementation.