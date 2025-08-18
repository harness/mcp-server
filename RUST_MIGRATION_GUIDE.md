# Harness MCP Server: Go to Rust Migration Guide

## Overview

This document provides a comprehensive guide for migrating the Harness MCP (Model Context Protocol) Server from Go to Rust. The migration aims to leverage Rust's safety and performance benefits while maintaining the same API surface and functionality.

## Table of Contents

1. [Migration Status](#migration-status)
2. [Project Structure Comparison](#project-structure-comparison)
3. [Dependency Mapping](#dependency-mapping)
4. [Key Pattern Translations](#key-pattern-translations)
5. [Architecture Changes](#architecture-changes)
6. [Build and Deployment](#build-and-deployment)
7. [Testing Strategy](#testing-strategy)
8. [Next Steps](#next-steps)
9. [Migration Checklist](#migration-checklist)

## Migration Status

### ✅ Completed
- **Codebase Analysis**: Comprehensive analysis of the existing Go codebase structure and patterns
- **Project Structure**: Created equivalent Rust project structure with proper module organization
- **Dependency Mapping**: Identified and configured Rust equivalents for all Go dependencies
- **Build System**: Created Rust-specific Makefile and Dockerfile
- **Foundation Code**: Implemented core modules (error handling, configuration, authentication)

### 🚧 In Progress
- **Module Migration**: Converting Go modules to Rust module structure
- **Source Code Migration**: Translating Go source files to idiomatic Rust
- **Testing Framework**: Migrating tests from Go testing to Rust's built-in framework

### ⏳ Pending
- **Concurrency Patterns**: Converting goroutines to async/await or threading
- **Validation**: Ensuring migrated functionality matches original implementation
- **CI/CD Updates**: Updating build scripts and deployment pipelines
- **Documentation**: Updating README and documentation for Rust version

## Project Structure Comparison

### Go Structure
```
harness-mcp/
├── cmd/harness-mcp-server/     # Main binary
├── pkg/harness/                # Core library
│   ├── auth/                   # Authentication
│   ├── tools/                  # Tool implementations (34 files)
│   └── ...
├── client/                     # API client code
├── test/e2e/                   # End-to-end tests
├── go.mod                      # Dependencies
├── Makefile                    # Build scripts
└── Dockerfile                  # Container build
```

### Rust Structure
```
harness-mcp-server/
├── src/
│   ├── bin/harness-mcp-server/ # Main binary
│   ├── auth/                   # Authentication module
│   ├── client/                 # HTTP client
│   ├── config/                 # Configuration
│   ├── tools/                  # Tool implementations
│   ├── modules/                # Module system
│   ├── error.rs                # Error handling
│   ├── utils.rs                # Utilities
│   └── lib.rs                  # Library root
├── Cargo.toml                  # Dependencies
├── Makefile.rust               # Build scripts
└── Dockerfile.rust             # Container build
```

## Dependency Mapping

| Go Dependency | Rust Equivalent | Purpose |
|---------------|-----------------|---------|
| `spf13/cobra` | `clap` | CLI framework |
| `spf13/viper` | `config` + `serde` | Configuration management |
| `golang-jwt/jwt` | `jsonwebtoken` | JWT token handling |
| `google/uuid` | `uuid` | UUID generation |
| `hashicorp/go-retryablehttp` | `reqwest` + `backoff` | HTTP client with retry |
| `mark3labs/mcp-go` | *Custom implementation needed* | MCP protocol |
| `stretchr/testify` | Built-in `#[test]` + `mockall` | Testing framework |
| Go's `slog` | `tracing` + `tracing-subscriber` | Structured logging |
| Go's `context` | `tokio` contexts | Cancellation and timeouts |
| Go's `fmt.Errorf` | `thiserror` + `anyhow` | Error handling |

## Key Pattern Translations

### Error Handling

**Go Pattern:**
```go
func doSomething() error {
    if err := validate(); err != nil {
        return fmt.Errorf("validation failed: %w", err)
    }
    return nil
}
```

**Rust Pattern:**
```rust
fn do_something() -> Result<()> {
    validate().context("validation failed")?;
    Ok(())
}
```

### Concurrency

**Go Pattern:**
```go
errC := make(chan error, 1)
go func() {
    errC <- doWork()
}()
```

**Rust Pattern:**
```rust
let handle = tokio::spawn(async {
    do_work().await
});
let result = handle.await?;
```

### HTTP Client

**Go Pattern:**
```go
client := &http.Client{Timeout: 30 * time.Second}
resp, err := client.Get(url)
```

**Rust Pattern:**
```rust
let client = reqwest::Client::builder()
    .timeout(Duration::from_secs(30))
    .build()?;
let resp = client.get(url).send().await?;
```

### Configuration

**Go Pattern:**
```go
type Config struct {
    APIKey    string `mapstructure:"api_key"`
    BaseURL   string `mapstructure:"base_url"`
    ReadOnly  bool   `mapstructure:"read_only"`
}
```

**Rust Pattern:**
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub api_key: String,
    pub base_url: String,
    pub read_only: bool,
}
```

## Architecture Changes

### 1. Memory Management
- **Go**: Garbage collected memory management
- **Rust**: Ownership system with compile-time memory safety
- **Impact**: More explicit lifetime management, but zero-cost abstractions

### 2. Error Handling
- **Go**: Explicit error returns with `error` interface
- **Rust**: `Result<T, E>` type with `?` operator for propagation
- **Benefit**: Compile-time guarantee that errors are handled

### 3. Concurrency Model
- **Go**: Goroutines with channels (M:N threading)
- **Rust**: `async/await` with `tokio` runtime
- **Benefit**: Zero-cost async abstractions with better performance

### 4. Type System
- **Go**: Structural typing with interfaces
- **Rust**: Nominal typing with traits
- **Benefit**: More expressive type system with compile-time guarantees

## Build and Deployment

### Development Commands

```bash
# Build the project
make -f Makefile.rust build

# Run tests
make -f Makefile.rust test

# Format code
make -f Makefile.rust fmt

# Run linting
make -f Makefile.rust clippy

# Build Docker image
make -f Makefile.rust docker-build
```

### Docker Deployment

```bash
# Build Rust version
docker build -f Dockerfile.rust -t harness/mcp-server-rust:latest .

# Run container
docker run -i --rm \
  -e HARNESS_API_KEY=your_api_key \
  -e HARNESS_DEFAULT_ORG_ID=your_org_id \
  -e HARNESS_DEFAULT_PROJECT_ID=your_project_id \
  harness/mcp-server-rust:latest
```

## Testing Strategy

### Unit Tests
- **Go**: `*testing.T` with `testify/assert`
- **Rust**: Built-in `#[test]` with `assert!` macros

### Integration Tests
- **Go**: E2E tests with build tags
- **Rust**: Integration tests in `tests/` directory

### Mocking
- **Go**: Interface-based mocking
- **Rust**: `mockall` crate for trait mocking

### Example Test Migration

**Go Test:**
```go
func TestAuthProvider(t *testing.T) {
    provider := NewAPIKeyProvider("test-key")
    header, value, err := provider.GetHeader(context.Background())
    assert.NoError(t, err)
    assert.Equal(t, "x-api-key", header)
    assert.Equal(t, "test-key", value)
}
```

**Rust Test:**
```rust
#[tokio::test]
async fn test_auth_provider() {
    let provider = ApiKeyProvider::new("test-key".to_string());
    let (header, value) = provider.get_header().await.unwrap();
    assert_eq!(header, "x-api-key");
    assert_eq!(value, "test-key");
}
```

## Next Steps

### Phase 1: Core Migration (High Priority)
1. **Complete Module Structure**: Finish converting Go packages to Rust modules
2. **Implement MCP Protocol**: Create Rust equivalent of `mark3labs/mcp-go`
3. **Migrate Tool Implementations**: Convert all 34 tool files from Go to Rust
4. **Authentication System**: Complete JWT and session management

### Phase 2: Feature Parity (Medium Priority)
1. **HTTP Client**: Implement full retry logic and error handling
2. **Configuration System**: Complete environment variable and file-based config
3. **Logging Integration**: Set up structured logging with `tracing`
4. **Concurrency Patterns**: Convert all goroutine usage to async/await

### Phase 3: Testing and Validation (High Priority)
1. **Unit Test Migration**: Convert all existing unit tests
2. **Integration Tests**: Migrate E2E test suite
3. **Performance Testing**: Validate performance improvements
4. **Functional Validation**: Ensure API compatibility

### Phase 4: Deployment and Documentation (Medium Priority)
1. **CI/CD Pipeline**: Update build and deployment scripts
2. **Documentation**: Update README and API documentation
3. **Migration Guide**: Complete this guide with lessons learned
4. **Performance Benchmarks**: Document performance improvements

## Migration Checklist

### ✅ Foundation
- [x] Project structure created
- [x] Cargo.toml with dependencies
- [x] Error handling framework
- [x] Configuration structure
- [x] Authentication module skeleton
- [x] HTTP client framework
- [x] Build system (Makefile.rust, Dockerfile.rust)

### 🚧 Core Implementation
- [ ] MCP protocol implementation
- [ ] Complete authentication system
- [ ] Tool registry and execution framework
- [ ] Module system implementation
- [ ] HTTP client with full retry logic
- [ ] Logging integration

### ⏳ Tool Migration
- [ ] Pipeline tools (get_pipeline, list_pipelines, etc.)
- [ ] Connector tools (get_connector_details, list_connector_catalogue)
- [ ] Dashboard tools (list_dashboards, get_dashboard_data)
- [ ] CCM tools (perspectives, recommendations, commitments)
- [ ] Security tools (STO, SCS)
- [ ] Other service tools (IDP, Chaos, etc.)

### ⏳ Testing
- [ ] Unit test framework setup
- [ ] Integration test migration
- [ ] E2E test migration
- [ ] Performance benchmarks
- [ ] Functional validation

### ⏳ Deployment
- [ ] CI/CD pipeline updates
- [ ] Docker image optimization
- [ ] Documentation updates
- [ ] Migration validation

## Performance Expectations

Based on typical Go to Rust migrations, we expect:

- **Memory Usage**: 20-40% reduction due to zero-cost abstractions
- **CPU Performance**: 10-30% improvement due to better optimization
- **Binary Size**: Potentially larger due to static linking, but more predictable
- **Startup Time**: Similar or slightly faster
- **Concurrency**: Better performance under high load due to async/await model

## Conclusion

The migration from Go to Rust represents a significant undertaking that will provide long-term benefits in terms of safety, performance, and maintainability. The foundation has been established with proper project structure, dependency mapping, and core architectural decisions.

The next critical phase involves implementing the MCP protocol in Rust and systematically migrating the extensive tool implementations while maintaining full API compatibility.

---

**Last Updated**: 2025-01-18  
**Migration Progress**: ~30% Complete  
**Estimated Completion**: 6-8 weeks for full migration