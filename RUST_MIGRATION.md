# Harness MCP Server - Rust Migration

This document describes the migration of the Harness MCP Server from Go to Rust.

## Project Structure

The Rust implementation uses a Cargo workspace with the following crates:

```
├── Cargo.toml                 # Workspace configuration
├── harness-mcp-server/        # Main binary crate
│   ├── Cargo.toml
│   └── src/
│       └── main.rs            # CLI entry point
├── harness-mcp-core/          # Core library
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs
│       ├── config.rs          # Configuration handling
│       ├── error.rs           # Error types
│       ├── logging.rs         # Tracing setup
│       ├── mcp.rs             # MCP protocol types
│       ├── server.rs          # Main server logic
│       ├── tools.rs           # Tool registry
│       ├── transport.rs       # Transport layer
│       └── types.rs           # Common types
└── harness-mcp-client/        # Harness API client
    ├── Cargo.toml
    └── src/
        ├── lib.rs
        ├── client.rs          # HTTP client
        ├── dto.rs             # Data transfer objects
        └── error.rs           # Client errors
```

## Key Technologies

- **Runtime**: Tokio for async/await
- **HTTP Server**: Axum with Tower middleware
- **HTTP Client**: Reqwest with rustls-tls
- **Serialization**: Serde with JSON support
- **Configuration**: Clap for CLI, Figment for config files
- **Logging**: Tracing with structured JSON output
- **Error Handling**: Thiserror for error types

## Configuration

Environment variables maintain the same `HARNESS_` prefix as the Go version:

- `HARNESS_API_KEY` - Required API key
- `HARNESS_DEFAULT_ORG_ID` - Default organization ID
- `HARNESS_DEFAULT_PROJECT_ID` - Default project ID
- `HARNESS_BASE_URL` - Harness base URL (default: https://app.harness.io)
- `HARNESS_TOOLSETS` - Comma-separated toolsets to enable
- `HARNESS_READ_ONLY` - Read-only mode flag
- `HARNESS_DEBUG` - Debug logging flag
- `HARNESS_LOG_FILE` - Log file path
- `HARNESS_OUTPUT_DIR` - Output directory for files

## CLI Commands

The Rust version maintains the same CLI structure:

```bash
# Stdio mode (external)
harness-mcp-server stdio --api-key=<key>

# HTTP server mode (internal)
harness-mcp-server http-server --port=8080 --path=/mcp

# Internal mode with bearer token
harness-mcp-server internal --bearer-token=<token>
```

## Migration Status

### ✅ Completed
- [x] Project structure setup
- [x] Configuration system
- [x] Error handling
- [x] Logging with tracing
- [x] Basic CLI structure
- [x] Client library foundation

### 🚧 In Progress
- [ ] MCP protocol implementation
- [ ] Tool registry and handlers
- [ ] Transport layer (stdio/HTTP)
- [ ] Harness API client implementations

### ⏳ Pending
- [ ] All tool implementations
- [ ] Authentication middleware
- [ ] Rate limiting and timeouts
- [ ] Comprehensive testing
- [ ] Docker image
- [ ] CI/CD pipeline

## Building and Running

```bash
# Build all crates
cargo build --release

# Run with stdio
cargo run --bin harness-mcp-server -- stdio --api-key=<your-key>

# Run with HTTP server
cargo run --bin harness-mcp-server -- http-server --port=8080

# Run tests
cargo test

# Format code
cargo fmt

# Lint code
cargo clippy
```

## API Compatibility

The Rust implementation maintains full API compatibility with the Go version:

- Same MCP protocol messages
- Same tool names and parameters
- Same JSON response schemas
- Same HTTP endpoints and paths
- Same environment variable names

## Performance Improvements

Expected improvements in the Rust version:

- Lower memory usage due to zero-cost abstractions
- Better async performance with Tokio
- Faster JSON serialization with Serde
- Reduced binary size
- Better error handling with type safety

## Testing Strategy

- Unit tests for all modules
- Integration tests for API compatibility
- Snapshot tests for JSON response validation
- Property-based testing for edge cases
- Performance benchmarks vs Go version