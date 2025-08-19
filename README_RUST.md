# Harness MCP Server (Rust Implementation)

The Harness MCP Server is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that provides seamless integration with Harness APIs, enabling advanced automation and interaction capabilities for developers and tools.

**🦀 This is the Rust implementation** - migrated from Go for improved performance, memory safety, and type safety.

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [Integration with AI Assistants](#integration-with-ai-assistants)
- [Development](#development)
- [Migration from Go](#migration-from-go)
- [Contributing](#contributing)

## Features

### Core Capabilities
- **MCP Protocol Support**: Full implementation of Model Context Protocol 2024-11-05
- **Async/Await**: Built on Tokio for high-performance async operations
- **Type Safety**: Rust's type system prevents runtime errors
- **Memory Safety**: No garbage collection overhead, zero-cost abstractions
- **HTTP Client**: Robust HTTP client with automatic retries and middleware

### Toolsets

The server implements several toolsets for different Harness services:

#### Default Toolset
- `get_connector_details`: Get details of a specific connector
- `list_connector_catalogue`: List the Harness connector catalogue
- `list_pipelines`: List pipelines in a repository
- `get_pipeline`: Get details of a specific pipeline
- `get_execution`: Get details of a specific pipeline execution
- `list_executions`: List pipeline executions
- `fetch_execution_url`: Fetch the execution URL for a pipeline execution
- `list_dashboards`: Lists all available Harness dashboards
- `get_dashboard_data`: Retrieves the data from a specific Harness dashboard

#### Specialized Toolsets
- **Pipelines**: Pipeline management and execution
- **Pull Requests**: Code review and repository management
- **Services**: Service definitions and management
- **Environments**: Environment configuration
- **Infrastructure**: Infrastructure definitions
- **Connectors**: External system integrations
- **Repositories**: Source code management
- **Registries**: Artifact registry operations
- **Dashboards**: Analytics and reporting
- **Cloud Cost Management (CCM)**: Cost optimization and analysis
- **Chaos Engineering**: Chaos experiments and resilience testing
- **Supply Chain Security (SCS)**: Security scanning and compliance
- **Security Test Orchestration (STO)**: Security testing automation
- **Internal Developer Portal (IDP)**: Developer experience tools

## Prerequisites

1. **Rust**: Version 1.70 or later
2. **Harness API Key**: For authentication with Harness services

## Installation

### From Source

1. Clone the repository:
```bash
git clone https://github.com/harness/mcp-server.git
cd mcp-server
```

2. Build the binary:
```bash
cargo build --release
```

3. The binary will be available at `target/release/harness-mcp-server`

### Using Cargo

```bash
cargo install harness-mcp-server
```

## Usage

### Basic Usage

```bash
# Set environment variables
export HARNESS_API_KEY=your_api_key
export HARNESS_DEFAULT_ORG_ID=your_org_id
export HARNESS_DEFAULT_PROJECT_ID=your_project_id

# Run the server
harness-mcp-server stdio
```

### Command Line Options

```bash
harness-mcp-server stdio [OPTIONS]

Options:
    --base-url <URL>              Base URL for Harness [default: https://app.harness.io]
    --api-key <KEY>               API key for authentication [env: HARNESS_API_KEY]
    --default-org-id <ID>         Default org ID [env: HARNESS_DEFAULT_ORG_ID]
    --default-project-id <ID>     Default project ID [env: HARNESS_DEFAULT_PROJECT_ID]
    --toolsets <LIST>             Comma-separated list of toolsets to enable [default: default]
    --enable-modules <LIST>       Comma-separated list of modules to enable
    --enable-license              Enable license validation
    --read-only                   Restrict to read-only operations
    --log-file <PATH>             Path to log file
    --debug                       Enable debug logging
    --help                        Print help information
    --version                     Print version information
```

### Docker Usage

```bash
docker run -i --rm \
  -e HARNESS_API_KEY=your_api_key \
  -e HARNESS_DEFAULT_ORG_ID=your_org_id \
  -e HARNESS_DEFAULT_PROJECT_ID=your_project_id \
  harness/mcp-server:rust stdio
```

## Configuration

### Environment Variables

All environment variables are prefixed with `HARNESS_`:

| Variable | Description | Required |
|----------|-------------|----------|
| `HARNESS_API_KEY` | Harness API key | Yes |
| `HARNESS_DEFAULT_ORG_ID` | Default organization ID | No |
| `HARNESS_DEFAULT_PROJECT_ID` | Default project ID | No |
| `HARNESS_BASE_URL` | Base URL for Harness | No (default: https://app.harness.io) |
| `HARNESS_TOOLSETS` | Comma-separated list of toolsets | No (default: all) |
| `HARNESS_READ_ONLY` | Set to "true" for read-only mode | No |
| `HARNESS_LOG_FILE` | Path to log file | No |
| `HARNESS_LOG_LEVEL` | Log level (debug, info, warn, error) | No |

### Configuration File

You can also use a configuration file (TOML format):

```toml
# config.toml
api_key = "your_api_key"
base_url = "https://app.harness.io"
default_org_id = "your_org_id"
default_project_id = "your_project_id"
read_only = false
debug = false

[toolsets]
enabled = ["pipelines", "connectors", "ccm"]
```

## Integration with AI Assistants

### Claude Desktop Configuration

On macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
On Windows: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "harness": {
      "command": "/path/to/harness-mcp-server",
      "args": ["stdio"],
      "env": {
        "HARNESS_API_KEY": "<YOUR_API_KEY>",
        "HARNESS_DEFAULT_ORG_ID": "<YOUR_ORG_ID>",
        "HARNESS_DEFAULT_PROJECT_ID": "<YOUR_PROJECT_ID>"
      }
    }
  }
}
```

### VS Code Configuration

```json
{
  "mcp": {
    "servers": {
      "harness": {
        "command": "/path/to/harness-mcp-server",
        "args": ["stdio"],
        "env": {
          "HARNESS_API_KEY": "<YOUR_API_KEY>",
          "HARNESS_DEFAULT_ORG_ID": "<YOUR_ORG_ID>",
          "HARNESS_DEFAULT_PROJECT_ID": "<YOUR_PROJECT_ID>"
        }
      }
    }
  }
}
```

### Cursor Configuration

```json
{
  "mcpServers": {
    "harness": {
      "command": "/path/to/harness-mcp-server",
      "args": ["stdio"],
      "env": {
        "HARNESS_API_KEY": "your_api_key",
        "HARNESS_DEFAULT_ORG_ID": "your_org_id",
        "HARNESS_DEFAULT_PROJECT_ID": "your_project_id"
      }
    }
  }
}
```

## Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/harness/mcp-server.git
cd mcp-server

# Install dependencies
cargo fetch

# Build in development mode
cargo build

# Build in release mode
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
├── config.rs            # Configuration management
├── server.rs            # MCP server implementation
├── modules.rs           # Module system
├── utils.rs             # Utility functions
└── harness/
    ├── mod.rs           # Harness module exports
    ├── auth.rs          # Authentication
    ├── client.rs        # HTTP client
    ├── dto.rs           # Data transfer objects
    ├── errors.rs        # Error types
    ├── event.rs         # Event handling
    ├── prompts.rs       # Prompt management
    └── tools.rs         # Tool implementations
```

### Code Quality

```bash
# Format code
cargo fmt

# Lint code
cargo clippy

# Check for security vulnerabilities
cargo audit

# Generate documentation
cargo doc --open
```

## Migration from Go

This Rust implementation is a complete rewrite of the original Go version with the following improvements:

### Performance Benefits
- **Zero-cost abstractions**: No runtime overhead for high-level features
- **No garbage collection**: Predictable memory usage and latency
- **Efficient async I/O**: Tokio-based async runtime
- **Optimized HTTP client**: Built-in connection pooling and retries

### Safety Benefits
- **Memory safety**: Prevents buffer overflows, use-after-free, and memory leaks
- **Type safety**: Compile-time error detection
- **Thread safety**: Data race prevention at compile time
- **Error handling**: Explicit error handling with `Result<T, E>`

### Developer Experience
- **Rich type system**: Algebraic data types and pattern matching
- **Excellent tooling**: Cargo, rustfmt, clippy, and IDE support
- **Documentation**: Built-in documentation generation
- **Testing**: Integrated testing framework

### Compatibility
- **API compatibility**: Same MCP protocol and tool interfaces
- **Configuration compatibility**: Same environment variables and options
- **Feature parity**: All Go features implemented in Rust

## Debugging

Since MCP servers run over stdio, debugging can be challenging. For the best debugging experience, we recommend using the [MCP Inspector](https://github.com/modelcontextprotocol/inspector).

```bash
# Install MCP Inspector
npm install -g @modelcontextprotocol/inspector

# Launch with inspector
npx @modelcontextprotocol/inspector /path/to/harness-mcp-server stdio
```

### Logging

Enable detailed logging for debugging:

```bash
# Set log level
export RUST_LOG=debug

# Or use specific modules
export RUST_LOG=harness_mcp_server=debug,reqwest=info

# Run with logging
harness-mcp-server stdio
```

## Testing

### Unit Tests

```bash
# Run all tests
cargo test

# Run specific test
cargo test test_name

# Run tests with output
cargo test -- --nocapture

# Run tests in parallel
cargo test -- --test-threads=4
```

### Integration Tests

```bash
# Run integration tests
cargo test --test integration

# Run with environment variables
HARNESS_API_KEY=test_key cargo test --test integration
```

### Benchmarks

```bash
# Run benchmarks
cargo bench

# Run specific benchmark
cargo bench bench_name
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for your changes
5. Ensure all tests pass (`cargo test`)
6. Format your code (`cargo fmt`)
7. Lint your code (`cargo clippy`)
8. Commit your changes (`git commit -m 'Add amazing feature'`)
9. Push to the branch (`git push origin feature/amazing-feature`)
10. Open a Pull Request

### Code Style

- Follow Rust standard formatting (`cargo fmt`)
- Address all clippy warnings (`cargo clippy`)
- Add documentation for public APIs
- Include tests for new functionality
- Update CHANGELOG.md for notable changes

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Support

- **Documentation**: [Harness Developer Hub](https://developer.harness.io/)
- **Community**: [Harness Community Slack](https://harnesscommunity.slack.com/)
- **Issues**: [GitHub Issues](https://github.com/harness/mcp-server/issues)
- **Security**: See [SECURITY.md](SECURITY.md) for security policy

---

**Note**: This is the Rust implementation of the Harness MCP Server. For the original Go implementation, see the `go` branch.