# Harness MCP Server (Rust Implementation)

A Rust implementation of the Harness Model Context Protocol (MCP) server, providing seamless integration with Harness APIs for advanced automation and interaction capabilities.

## Project Structure

This is a Rust workspace containing multiple crates:

- `harness-mcp-server/` - Main server binary and library
- `harness-mcp-client/` - Harness API client library  
- `harness-mcp-proto/` - MCP protocol implementation

## Prerequisites

- Rust 1.79+ with stable toolchain
- Cargo (included with Rust)

## Building

```bash
# Build all crates
cargo build

# Build in release mode
cargo build --release

# Run tests
cargo test

# Run clippy linter
cargo clippy

# Format code
cargo fmt
```

## Running

### STDIO Mode (for AI assistants)

```bash
cargo run --bin harness-mcp-server -- stdio --api-key YOUR_API_KEY
```

### HTTP Server Mode

```bash
cargo run --bin harness-mcp-server -- http-server --port 8080
```

### Internal Mode

```bash
cargo run --bin harness-mcp-server -- internal --bearer-token YOUR_TOKEN
```

## Configuration

The server can be configured via:

1. Command line arguments
2. Environment variables (prefixed with `HARNESS_`)
3. Configuration file (YAML format)
4. `.env` file

### Environment Variables

- `HARNESS_API_KEY` - API key for authentication
- `HARNESS_BEARER_TOKEN` - Bearer token for internal mode
- `HARNESS_BASE_URL` - Base URL for Harness (default: https://app.harness.io)
- `HARNESS_DEBUG` - Enable debug logging
- `HARNESS_LOG_FORMAT` - Log format (text or json)

## Docker

```bash
# Build Docker image
docker build -t harness-mcp-server .

# Run container
docker run -e HARNESS_API_KEY=your_key harness-mcp-server stdio
```

## Development

### Adding New Tools

1. Implement the tool in `harness-mcp-server/src/tools/`
2. Register it in the appropriate toolset
3. Add tests

### Adding New Services

1. Implement the service client in `harness-mcp-client/src/services/`
2. Add authentication and retry logic
3. Add integration tests

## Migration from Go

This Rust implementation maintains API compatibility with the original Go version while providing:

- Better type safety
- Improved error handling
- Enhanced performance
- Memory safety guarantees
- Modern async/await patterns

## License

Apache 2.0 - See LICENSE file for details.