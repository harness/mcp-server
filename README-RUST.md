# Harness MCP Server - Rust Implementation

This is the Rust implementation of the Harness MCP Server, migrated from the original Go implementation.

## Project Structure

The project is organized as a Cargo workspace with the following crates:

- **`harness-mcp-server`** - Main binary crate containing the server executable
- **`harness-mcp-core`** - Core MCP protocol implementation and types
- **`harness-mcp-client`** - HTTP client library for Harness APIs
- **`harness-mcp-tools`** - Tool implementations for various Harness services
- **`harness-mcp-auth`** - Authentication and authorization components
- **`harness-mcp-config`** - Configuration management

## Prerequisites

- Rust 1.70+ (2021 edition)
- Cargo (comes with Rust)

## Building

```bash
# Build all crates
cargo build

# Build in release mode
cargo build --release

# Check for compilation errors without building
cargo check
```

## Running

```bash
# Run with stdio transport
cargo run --bin harness-mcp-server -- stdio --api-key YOUR_API_KEY

# Run with HTTP transport
cargo run --bin harness-mcp-server -- http --port 8080

# Run with internal transport
cargo run --bin harness-mcp-server -- internal --bearer-token YOUR_TOKEN --mcp-svc-secret YOUR_SECRET
```

## Configuration

The server can be configured through:

1. **Command-line arguments** - See `--help` for available options
2. **Environment variables** - Prefixed with `HARNESS_`
3. **Configuration files** - `harness-mcp.toml` or `harness-mcp.yaml`

### Environment Variables

- `HARNESS_API_KEY` - API key for authentication
- `HARNESS_DEFAULT_ORG_ID` - Default organization ID
- `HARNESS_DEFAULT_PROJECT_ID` - Default project ID
- `HARNESS_BASE_URL` - Base URL for Harness (default: https://app.harness.io)

## Architecture

### Core Components

1. **MCP Protocol Layer** (`harness-mcp-core`)
   - JSON-RPC 2.0 implementation
   - MCP message types and serialization
   - Transport abstractions (stdio, HTTP)

2. **Authentication Layer** (`harness-mcp-auth`)
   - API key authentication
   - JWT token handling
   - Session management
   - Bearer token authentication

3. **Client Layer** (`harness-mcp-client`)
   - HTTP client with retry logic
   - Service-specific clients
   - Request/response DTOs

4. **Tools Layer** (`harness-mcp-tools`)
   - Tool implementations for each Harness service
   - Toolset organization and management
   - Read-only mode support

5. **Configuration Layer** (`harness-mcp-config`)
   - Multi-source configuration loading
   - Environment variable handling
   - CLI argument parsing

### Key Features

- **Async/Await**: Built on Tokio for high-performance async I/O
- **Type Safety**: Leverages Rust's type system for compile-time guarantees
- **Error Handling**: Comprehensive error types with `thiserror`
- **Logging**: Structured logging with `tracing`
- **Configuration**: Flexible configuration with `figment`
- **HTTP Server**: High-performance HTTP server with `axum`
- **HTTP Client**: Robust HTTP client with `reqwest`

## Migration Notes

This Rust implementation maintains API compatibility with the original Go version:

- All REST endpoints are preserved
- Request/response schemas are identical
- CLI flags and environment variables are maintained
- Configuration behavior is consistent

### Key Differences

1. **Performance**: Rust implementation provides better memory safety and performance
2. **Error Handling**: More explicit error handling with `Result<T, E>` types
3. **Async Model**: Uses Rust's async/await instead of Go's goroutines
4. **Type Safety**: Compile-time guarantees prevent many runtime errors

## Testing

```bash
# Run unit tests
cargo test

# Run tests with output
cargo test -- --nocapture

# Run specific test
cargo test test_name
```

## Docker

```bash
# Build Docker image
docker build -t harness/mcp-server-rust .

# Run with Docker
docker run -i --rm \
  -e HARNESS_API_KEY=your_api_key \
  -e HARNESS_DEFAULT_ORG_ID=your_org_id \
  -e HARNESS_DEFAULT_PROJECT_ID=your_project_id \
  harness/mcp-server-rust stdio
```

## Development

### Adding New Tools

1. Create a new module in `crates/harness-mcp-tools/src/tools/`
2. Implement the tool using the `Tool` trait
3. Register the tool in the appropriate toolset
4. Add tests for the tool functionality

### Adding New Services

1. Create a new service client in `crates/harness-mcp-client/src/services/`
2. Define DTOs in `crates/harness-mcp-client/src/dto/`
3. Implement authentication if needed
4. Add integration tests

## Performance Considerations

- Uses connection pooling for HTTP clients
- Implements request retry logic with exponential backoff
- Supports concurrent request processing
- Memory-efficient JSON streaming for large responses

## Security

- Secure credential handling
- Input validation and sanitization
- Rate limiting support
- TLS/SSL support for all HTTP communications

## Contributing

1. Follow Rust coding conventions
2. Add tests for new functionality
3. Update documentation
4. Run `cargo fmt` and `cargo clippy` before submitting