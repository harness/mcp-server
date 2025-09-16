# Harness MCP Server (Rust)

A Rust implementation of the Harness MCP Server, providing seamless integration with Harness APIs through the Model Context Protocol (MCP).

## Features

- **High Performance**: Built with Rust for maximum performance and memory safety
- **Async/Await**: Full async support using Tokio runtime
- **Multiple Transports**: Support for stdio and HTTP transports
- **Comprehensive Toolsets**: 20+ toolsets covering all Harness services
- **Type Safety**: Strong typing with serde for JSON serialization
- **Error Handling**: Robust error handling with Result types
- **Logging**: Structured logging with tracing

## Quick Start

### Prerequisites

- Rust 1.70+ (2021 edition)
- Harness API key

### Installation

```bash
# Clone the repository
git clone https://github.com/harness/mcp-server.git
cd mcp-server

# Build the project
cargo build --release

# Run with stdio transport
HARNESS_API_KEY=your_api_key ./target/release/harness-mcp-server stdio

# Run with HTTP transport
./target/release/harness-mcp-server http --port 8080
```

### Configuration

The server can be configured through command-line arguments or environment variables:

#### Environment Variables

- `HARNESS_API_KEY`: Your Harness API key (required for stdio mode)
- `HARNESS_BASE_URL`: Base URL for Harness (default: https://app.harness.io)
- `HARNESS_DEFAULT_ORG_ID`: Default organization ID
- `HARNESS_DEFAULT_PROJECT_ID`: Default project ID

#### Command Line Options

```bash
# Show help
./target/release/harness-mcp-server --help

# Enable debug logging
./target/release/harness-mcp-server --debug stdio

# Specify toolsets
./target/release/harness-mcp-server --toolsets pipelines,connectors stdio

# Read-only mode
./target/release/harness-mcp-server --read-only stdio
```

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
RUST_LOG=debug cargo run -- stdio
```

### Project Structure

```
src/
├── main.rs              # Application entry point
├── config/              # Configuration management
├── error/               # Error types and handling
├── mcp/                 # MCP protocol implementation
│   ├── protocol.rs      # MCP protocol types
│   ├── server.rs        # MCP server implementation
│   ├── stdio.rs         # Stdio transport
│   ├── http.rs          # HTTP transport
│   └── internal.rs      # Internal mode
├── client/              # HTTP client and Harness API wrappers
├── toolsets/            # Toolset registry and management
└── tools/               # Individual tool implementations
```

### Adding New Tools

1. Create a new tool module in `src/tools/`
2. Implement the `ToolHandler` trait
3. Register the tool in the appropriate toolset
4. Add tests

Example:

```rust
use crate::mcp::{ToolHandler, Tool, CallToolRequest, CallToolResponse};
use async_trait::async_trait;

pub struct MyTool;

#[async_trait]
impl ToolHandler for MyTool {
    async fn call(&self, request: CallToolRequest) -> Result<CallToolResponse> {
        // Implementation
    }

    fn definition(&self) -> Tool {
        // Tool definition
    }
}
```

## Architecture

The Rust implementation follows these design principles:

- **Memory Safety**: Leverages Rust's ownership system for memory safety
- **Performance**: Zero-cost abstractions and efficient async I/O
- **Type Safety**: Strong typing prevents runtime errors
- **Modularity**: Clean separation of concerns with trait-based design
- **Async-First**: Built for async/await from the ground up

## Dependencies

Key dependencies and their purposes:

- `tokio`: Async runtime
- `clap`: Command-line argument parsing
- `reqwest`: HTTP client
- `axum`: HTTP server framework
- `serde`: Serialization/deserialization
- `tracing`: Structured logging
- `anyhow`/`thiserror`: Error handling

## Build Instructions

For detailed build instructions, deployment guides, and troubleshooting, see [BUILD.md](BUILD.md).

## License

Apache License 2.0 - see LICENSE file for details.