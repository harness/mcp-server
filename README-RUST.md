# Harness MCP Server - Rust Implementation

This is a Rust implementation of the Harness MCP (Model Context Protocol) Server, migrated from the original Go implementation.

## Features

- **Full MCP Protocol Support**: Implements the complete MCP protocol for tools, resources, and prompts
- **Multiple Transport Modes**: Supports both stdio and HTTP transport
- **Async/Await**: Built on Tokio for high-performance async operations
- **Type Safety**: Leverages Rust's type system for compile-time safety
- **Error Handling**: Comprehensive error handling with Result types
- **Authentication**: JWT-based authentication with session management
- **Modular Architecture**: Clean separation of concerns with modules
- **Extensive Toolsets**: Support for all Harness toolsets (pipelines, connectors, dashboards, etc.)

## Architecture

The Rust implementation maintains the same architecture as the Go version but leverages Rust's strengths:

```
src/
├── main.rs              # Entry point with CLI
├── config.rs            # Configuration management
├── error.rs             # Error types and handling
├── server/              # Server implementations
│   ├── http.rs          # HTTP server (axum)
│   └── stdio.rs         # Stdio server
├── auth/                # Authentication
│   ├── jwt.rs           # JWT handling
│   └── session.rs       # Session management
├── tools/               # MCP tools implementation
├── modules/             # Module system
├── types/               # Type definitions
│   ├── dto.rs           # Data transfer objects
│   ├── scope.rs         # Scope handling
│   └── transport.rs     # Transport types
└── utils/               # Utility functions
```

## Dependencies

Key Rust crates used:

- **tokio**: Async runtime
- **axum**: HTTP server framework
- **reqwest**: HTTP client
- **serde**: Serialization/deserialization
- **clap**: CLI argument parsing
- **tracing**: Structured logging
- **jsonwebtoken**: JWT handling
- **chrono**: Date/time handling
- **anyhow/thiserror**: Error handling

## Usage

### Build

```bash
cargo build --release
```

### Run

#### Stdio Mode (External)
```bash
cargo run -- stdio \
  --api-key "pat.your_account_id.your_token_id.your_token_value" \
  --default-org-id "your_org" \
  --default-project-id "your_project"
```

#### HTTP Server Mode
```bash
cargo run -- http-server \
  --http-port 8080 \
  --http-path "/mcp"
```

#### Internal Mode
```bash
cargo run -- internal \
  --bearer-token "your_bearer_token" \
  --mcp-svc-secret "your_secret"
```

### Options

- `--debug`: Enable debug logging
- `--log-file <PATH>`: Log to file
- `--toolsets <LIST>`: Comma-separated toolsets to enable
- `--enable-modules <LIST>`: Comma-separated modules to enable
- `--read-only`: Run in read-only mode
- `--output-dir <PATH>`: Output directory for files

## Migration Status

### ✅ Completed
- [x] Project structure and Cargo.toml
- [x] Basic CLI with clap
- [x] Configuration management
- [x] Error handling with thiserror
- [x] Transport type definitions
- [x] Scope and DTO types
- [x] JWT authentication framework
- [x] Session management
- [x] HTTP server with axum
- [x] Stdio server foundation
- [x] Module registry structure
- [x] Time utilities
- [x] Basic compilation and testing

### 🚧 In Progress
- [ ] MCP protocol implementation
- [ ] Tool implementations (pipelines, connectors, etc.)
- [ ] HTTP client utilities
- [ ] Parameter extraction utilities
- [ ] Complete authentication flow
- [ ] Module system implementation

### 📋 TODO
- [ ] All 100+ MCP tools
- [ ] Resource implementations
- [ ] Prompt implementations
- [ ] Complete test suite migration
- [ ] Performance optimizations
- [ ] Documentation generation
- [ ] CI/CD pipeline
- [ ] Docker support

## Key Differences from Go Implementation

1. **Type Safety**: Rust's type system prevents many runtime errors
2. **Memory Safety**: No garbage collector, but memory-safe by design
3. **Error Handling**: Result types instead of error returns
4. **Async Model**: Tokio's async/await vs Go's goroutines
5. **Serialization**: Serde instead of Go's encoding/json
6. **HTTP Framework**: Axum instead of net/http
7. **CLI**: Clap instead of Cobra
8. **Configuration**: Custom config vs Viper

## Performance Benefits

- **Zero-cost abstractions**: Rust's abstractions have no runtime overhead
- **Memory efficiency**: No garbage collection pauses
- **Compile-time optimizations**: Extensive compile-time optimizations
- **Async efficiency**: Tokio's efficient async runtime

## Development

### Prerequisites
- Rust 1.70+ (install via [rustup](https://rustup.rs/))
- Cargo (comes with Rust)

### Development Commands
```bash
# Check code
cargo check

# Run tests
cargo test

# Format code
cargo fmt

# Lint code
cargo clippy

# Build documentation
cargo doc --open
```

### Testing
```bash
# Run unit tests
cargo test --lib

# Run integration tests
cargo test --test '*'

# Run with environment variables
HARNESS_API_KEY=your_key cargo test
```

## Contributing

1. Follow Rust conventions and idioms
2. Use `cargo fmt` for formatting
3. Run `cargo clippy` for linting
4. Add tests for new functionality
5. Update documentation

## License

Same as the original Go implementation.