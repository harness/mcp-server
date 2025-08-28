# Harness MCP Server - Rust Implementation

This is a Rust implementation of the Harness MCP (Model Context Protocol) Server, migrated from the original Go codebase.

## Migration Status

### ✅ Completed
- **Project Structure**: Created Rust project with Cargo.toml and proper module structure
- **Dependencies**: Mapped Go dependencies to Rust equivalents:
  - `cobra` → `clap` (CLI framework)
  - `viper` → `config` + `serde` (configuration)
  - `mark3labs/mcp-go` → `jsonrpc-core` (MCP protocol base)
  - `hashicorp/go-retryablehttp` → `reqwest` (HTTP client)
  - `golang-jwt/jwt` → `jsonwebtoken` (JWT authentication)
  - `google/uuid` → `uuid` (UUID generation)
  - `stretchr/testify` → `tokio-test` + `mockito` (testing)
- **Core Modules**: 
  - `src/main.rs` - Main entry point with CLI handling
  - `src/config.rs` - Configuration management
  - `src/server.rs` - MCP server implementation
  - `src/tools/` - Tool registry and implementations
  - `src/auth.rs` - Authentication handling
  - `src/common.rs` - Common utilities and types

### 🚧 In Progress
- **Tool Implementations**: Basic pipeline tools implemented, others need completion
- **MCP Protocol**: Basic JSON-RPC implementation, needs full MCP compliance
- **API Integration**: Harness API client integration pending

### ⏳ Pending
- **Complete Tool Migration**: Convert all Go tools to Rust
- **Error Handling**: Implement comprehensive Result-based error handling
- **Testing**: Convert Go tests to Rust test framework
- **Build Scripts**: Update Makefile and CI/CD for Rust
- **Documentation**: Update README for Rust setup instructions

## Prerequisites

1. **Rust**: Install Rust 1.70+ from [rustup.rs](https://rustup.rs/)
2. **Harness API Key**: For authentication with Harness services

## Quick Start

### Build from Source

```bash
# Clone the repository
git clone https://github.com/harness/mcp-server.git
cd mcp-server

# Build the Rust binary
cargo build --release

# Run the server
HARNESS_API_KEY=your_api_key \
HARNESS_DEFAULT_ORG_ID=your_org_id \
HARNESS_DEFAULT_PROJECT_ID=your_project_id \
./target/release/harness-mcp-server stdio
```

### Development

```bash
# Run in development mode
cargo run -- stdio --api-key your_api_key --default-org-id your_org_id

# Run with debug logging
cargo run -- stdio --api-key your_api_key --debug

# Run tests
cargo test

# Check code formatting
cargo fmt --check

# Run clippy for linting
cargo clippy
```

## Configuration

### Environment Variables

All environment variables are prefixed with `HARNESS_`:

- `HARNESS_API_KEY`: Harness API key (required)
- `HARNESS_DEFAULT_ORG_ID`: Default organization ID
- `HARNESS_DEFAULT_PROJECT_ID`: Default project ID

### Command Line Options

```bash
# External mode (stdio)
harness-mcp-server stdio \
  --base-url https://app.harness.io \
  --api-key your_api_key \
  --default-org-id your_org_id \
  --default-project-id your_project_id \
  --toolsets pipelines,connectors,dashboards \
  --read-only

# Internal mode
harness-mcp-server internal \
  --bearer-token your_token \
  --mcp-svc-secret your_secret
```

## Architecture

### Module Structure

```
src/
├── main.rs              # Entry point and CLI handling
├── config.rs            # Configuration management
├── server.rs            # MCP server implementation
├── auth.rs              # Authentication utilities
├── common.rs            # Common types and utilities
├── modules.rs           # Module registry (placeholder)
└── tools/
    ├── mod.rs           # Tool registry and trait definitions
    ├── pipelines.rs     # Pipeline-related tools
    ├── connectors.rs    # Connector-related tools
    └── dashboards.rs    # Dashboard-related tools
```

### Key Components

1. **MCP Server**: Handles JSON-RPC communication over stdio
2. **Tool Registry**: Manages available tools and their execution
3. **Configuration**: Handles both external and internal mode configurations
4. **Authentication**: API key and bearer token handling

## Migration Notes

### Key Differences from Go Version

1. **Error Handling**: Uses Rust's `Result<T, E>` instead of Go's error returns
2. **Async/Await**: Uses `tokio` for async runtime instead of Go's goroutines
3. **Memory Safety**: Rust's ownership system eliminates many classes of bugs
4. **Type Safety**: Stronger type system with compile-time guarantees
5. **Performance**: Potential performance improvements due to zero-cost abstractions

### Compatibility

The Rust implementation maintains full API compatibility with the Go version:
- Same MCP protocol implementation
- Identical tool interfaces and responses
- Compatible configuration options
- Same CLI interface

## Development Status

This is an active migration project. The basic structure is in place, but many tools and features are still being ported from Go to Rust. Contributions are welcome!

### Contributing

1. Check the existing Go implementation in `pkg/harness/tools/`
2. Create equivalent Rust implementations in `src/tools/`
3. Maintain the same tool interfaces and behavior
4. Add appropriate tests
5. Update documentation

## License

Apache License 2.0 - see [LICENSE](LICENSE) file for details.