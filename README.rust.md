# Harness MCP Server (Rust)

The Harness MCP Server is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that provides seamless integration with Harness APIs, enabling advanced automation and interaction capabilities for developers and tools.

**This is the Rust implementation, migrated from the original Go version.**

## Features

- **High Performance**: Built with Rust for maximum performance and memory safety
- **Async/Await**: Full async support using tokio runtime
- **Type Safety**: Leverages Rust's type system for compile-time safety
- **Memory Safety**: Zero-cost abstractions with guaranteed memory safety
- **Cross-platform**: Runs on Linux, macOS, and Windows

## Prerequisites

1. Rust 1.75 or later
2. A Harness API key for authentication

## Quick Start

### Build from Source

```bash
# Clone the repository
git clone https://github.com/harness/mcp-server.git
cd mcp-server

# Build the project
cargo build --release

# Run the server
HARNESS_API_KEY=your_api_key \
HARNESS_DEFAULT_ORG_ID=your_org_id \
HARNESS_DEFAULT_PROJECT_ID=your_project_id \
./target/release/harness-mcp-server stdio
```

### Using Docker

```bash
docker build -f Dockerfile.rust -t harness/mcp-server:rust .

docker run -i --rm \
  -e HARNESS_API_KEY=your_api_key \
  -e HARNESS_DEFAULT_ORG_ID=your_org_id \
  -e HARNESS_DEFAULT_PROJECT_ID=your_project_id \
  harness/mcp-server:rust stdio
```

## Usage

### Command Line Options

```bash
# Start stdio server
harness-mcp-server stdio --api-key YOUR_API_KEY

# Start HTTP server
harness-mcp-server http-server --http-port 8080

# Start internal server
harness-mcp-server internal --bearer-token YOUR_TOKEN --mcp-svc-secret YOUR_SECRET
```

### Environment Variables

All environment variables are prefixed with `HARNESS_`:

- `HARNESS_API_KEY`: Harness API key (required for stdio mode)
- `HARNESS_DEFAULT_ORG_ID`: Default organization ID
- `HARNESS_DEFAULT_PROJECT_ID`: Default project ID
- `HARNESS_BASE_URL`: Base URL for Harness (default: "https://app.harness.io")

## Development

### Building

```bash
# Debug build
cargo build

# Release build
cargo build --release

# Run tests
cargo test

# Run with logging
RUST_LOG=debug cargo run -- stdio --api-key YOUR_KEY
```

### Project Structure

```
src/
├── main.rs              # Application entry point
├── config/              # Configuration management
├── harness/             # Core Harness functionality
│   ├── auth/            # Authentication
│   ├── tools/           # Tool implementations
│   ├── server.rs        # MCP server implementation
│   └── ...
├── client/              # Harness API client
├── modules/             # Feature modules
├── types/               # Type definitions
└── utils/               # Utility functions
```

## Performance

The Rust implementation provides several performance benefits:

- **Zero-cost abstractions**: No runtime overhead for high-level features
- **Memory efficiency**: Precise memory management without garbage collection
- **Async performance**: Efficient async I/O with tokio
- **Compile-time optimization**: Aggressive optimizations at compile time

## Migration from Go

This Rust implementation maintains API compatibility with the original Go version while providing:

- Better performance and lower memory usage
- Compile-time safety guarantees
- Modern async/await patterns
- Enhanced error handling with Result types

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Run `cargo test` and `cargo clippy`
6. Submit a pull request

## License

Apache License 2.0