# Harness MCP Server (Rust)

This is the Rust implementation of the Harness MCP Server, migrated from the original Go codebase.

## Architecture

The Rust implementation follows a modular architecture with the following crates:

### Core Crates

- **`harness-mcp-core`**: Core MCP server functionality, transport layer, and error handling
- **`harness-mcp-config`**: Configuration management and validation
- **`harness-mcp-auth`**: Authentication and authorization providers
- **`harness-mcp-client`**: HTTP client library for Harness APIs
- **`harness-mcp-tools`**: MCP tools implementation for various Harness services
- **`harness-mcp-modules`**: Module system for organizing tools by Harness product

### Key Features

- **Async/Await**: Built on Tokio for high-performance async operations
- **Type Safety**: Leverages Rust's type system for compile-time safety
- **Error Handling**: Comprehensive error handling with `Result<T, E>` types
- **Memory Safety**: Zero-cost abstractions without garbage collection
- **Modular Design**: Clean separation of concerns across crates

## Building

```bash
# Build the project
cargo build

# Build in release mode
cargo build --release

# Run tests
cargo test

# Run with logging
RUST_LOG=debug cargo run -- stdio --api-key YOUR_API_KEY
```

## Usage

### Stdio Mode

```bash
cargo run -- stdio \
  --api-key YOUR_API_KEY \
  --default-org-id YOUR_ORG_ID \
  --default-project-id YOUR_PROJECT_ID \
  --toolsets pipelines,connectors
```

### HTTP Server Mode

```bash
cargo run -- http-server \
  --port 8080 \
  --path /mcp \
  --toolsets all
```

### Internal Mode

```bash
cargo run -- internal \
  --bearer-token YOUR_BEARER_TOKEN \
  --mcp-svc-secret YOUR_SECRET \
  --toolsets all
```

## Configuration

The server supports configuration through:

- Command-line arguments
- Environment variables (prefixed with `HARNESS_`)
- Configuration files (YAML/JSON)

### Environment Variables

- `HARNESS_API_KEY`: API key for authentication
- `HARNESS_DEFAULT_ORG_ID`: Default organization ID
- `HARNESS_DEFAULT_PROJECT_ID`: Default project ID
- `HARNESS_BEARER_TOKEN`: Bearer token for internal mode
- `RUST_LOG`: Logging level (debug, info, warn, error)

## Development

### Project Structure

```
├── src/                    # Main binary
├── crates/
│   ├── harness-mcp-core/   # Core functionality
│   ├── harness-mcp-config/ # Configuration
│   ├── harness-mcp-auth/   # Authentication
│   ├── harness-mcp-client/ # HTTP client
│   ├── harness-mcp-tools/  # MCP tools
│   └── harness-mcp-modules/# Module system
├── Cargo.toml             # Workspace configuration
└── README-rust.md         # This file
```

### Adding New Tools

1. Define the tool in `harness-mcp-tools/src/`
2. Implement the tool handler with proper error handling
3. Register the tool in the appropriate toolset
4. Add tests for the tool functionality

### Adding New Modules

1. Create a new module in `harness-mcp-modules/src/`
2. Implement the `Module` trait
3. Register tools and configure dependencies
4. Add module to the registry

## Testing

```bash
# Run all tests
cargo test

# Run tests with output
cargo test -- --nocapture

# Run specific test
cargo test test_name

# Run tests for specific crate
cargo test -p harness-mcp-core
```

## Performance

The Rust implementation provides several performance benefits:

- **Zero-cost abstractions**: No runtime overhead for high-level constructs
- **Memory efficiency**: No garbage collection, predictable memory usage
- **Async performance**: Tokio runtime for efficient I/O operations
- **Compile-time optimizations**: Rust compiler optimizations

## Migration Notes

This Rust implementation maintains 100% API compatibility with the original Go version while providing:

- Improved memory safety
- Better error handling
- Enhanced performance
- More maintainable code structure

## Contributing

1. Follow Rust naming conventions (snake_case for functions, PascalCase for types)
2. Use `clippy` for code quality: `cargo clippy`
3. Format code with `rustfmt`: `cargo fmt`
4. Add comprehensive tests for new functionality
5. Update documentation for API changes

## License

Apache License 2.0 - see LICENSE file for details.