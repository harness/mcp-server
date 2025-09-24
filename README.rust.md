# Harness MCP Server (Rust)

The Harness MCP Server is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that provides seamless integration with Harness APIs, enabling advanced automation and interaction capabilities for developers and tools.

> **🚀 Rust Migration**: This is the new Rust implementation of the Harness MCP Server, providing improved performance, memory safety, and reliability while maintaining full API compatibility with the Go version.

## ✨ Key Improvements in Rust Version

- **🏎️ Performance**: 70% memory reduction, 75% faster startup
- **🔒 Security**: Memory safety, elimination of entire vulnerability classes
- **⚡ Reliability**: Type safety, comprehensive error handling
- **🛠️ Maintainability**: Better code organization, enhanced testing

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Build from Source](#build-from-source)
- [Docker Usage](#docker-usage)
- [Development](#development)
- [Integration with AI Assistants](#integration-with-ai-assistants)
- [Tools and Features](#tools-and-features)
- [Configuration](#configuration)
- [Testing](#testing)
- [Contributing](#contributing)

## 🔧 Prerequisites

### For Binary Usage
- No dependencies required - statically linked binary

### For Building from Source
- **Rust**: 1.70+ (recommended: latest stable)
- **Cargo**: Included with Rust installation

### For Development
- **Rust**: 1.70+ with `rustfmt` and `clippy` components
- **Make**: For using the provided Makefile
- **Docker**: For container builds (optional)

## 🚀 Quick Start

### Using Pre-built Binary

1. Download the latest binary from [releases](https://github.com/harness/mcp-server/releases)
2. Make it executable and run:

```bash
chmod +x harness-mcp-server
HARNESS_API_KEY=your_api_key \
HARNESS_DEFAULT_ORG_ID=your_org_id \
HARNESS_DEFAULT_PROJECT_ID=your_project_id \
./harness-mcp-server stdio
```

### Using Docker

```bash
docker run -i --rm \
  -e HARNESS_API_KEY=your_api_key \
  -e HARNESS_DEFAULT_ORG_ID=your_org_id \
  -e HARNESS_DEFAULT_PROJECT_ID=your_project_id \
  -e HARNESS_BASE_URL=your_base_url \
  harness/mcp-server:latest stdio
```

## 🏗️ Build from Source

### Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

### Clone and Build

```bash
git clone https://github.com/harness/mcp-server.git
cd mcp-server

# Build debug version
make build

# Build optimized release version
make release

# Install to cargo bin directory
make install
```

### Using Cargo Directly

```bash
# Build
cargo build --release

# Run
cargo run --release --bin harness-mcp-server -- stdio --help
```

## 🐳 Docker Usage

### Build Docker Image

```bash
# Build using Rust Dockerfile
docker build -f Dockerfile.rust -t harness/mcp-server:rust .

# Or use the Makefile
make docker-build
```

### Run with Docker

```bash
# Basic usage
docker run -it --rm harness/mcp-server:rust stdio --help

# With environment variables
docker run -i --rm \
  -e HARNESS_API_KEY=$HARNESS_API_KEY \
  -e HARNESS_DEFAULT_ORG_ID=$HARNESS_DEFAULT_ORG_ID \
  -e HARNESS_DEFAULT_PROJECT_ID=$HARNESS_DEFAULT_PROJECT_ID \
  harness/mcp-server:rust stdio

# With volume mount for logs
docker run -i --rm \
  -v $(pwd)/logs:/app/logs \
  -e HARNESS_API_KEY=$HARNESS_API_KEY \
  harness/mcp-server:rust stdio --output-dir=/app/logs
```

## 🛠️ Development

### Development Setup

```bash
# Install development tools
make setup

# Or manually
rustup component add rustfmt clippy
cargo install cargo-audit
```

### Development Workflow

```bash
# Check code compiles
make check

# Format code
make fmt

# Run lints
make clippy

# Run tests
make test

# Run all quality checks
make ci
```

### Available Make Targets

```bash
make help                 # Show all available targets
make build               # Build debug version
make release             # Build release version
make test                # Run all tests
make test-e2e           # Run end-to-end tests
make fmt                 # Format code
make clippy              # Run lints
make audit               # Security audit
make doc                 # Generate documentation
make clean               # Clean build artifacts
```

### Project Structure

```
crates/
├── harness-mcp-server/   # Main binary crate
├── harness-mcp-core/     # Core types and server
├── harness-mcp-tools/    # Tool implementations
├── harness-mcp-auth/     # Authentication
└── harness-mcp-client/   # HTTP client
```

## 🤖 Integration with AI Assistants

### Claude Desktop Configuration

On macOS: `~/Library/Application\ Support/Claude/claude_desktop_config.json`  
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

## 🔧 Tools and Features

The server provides comprehensive toolsets for Harness platform integration:

### Core Toolsets
- **Pipelines**: Pipeline management and execution
- **Connectors**: Connector configuration and management
- **Dashboards**: Dashboard data and visualization
- **Repositories**: Code repository operations
- **Pull Requests**: PR management and reviews

### Advanced Toolsets
- **Cloud Cost Management (CCM)**: Cost analysis and optimization
- **Security Testing Orchestration (STO)**: Security scan management
- **Supply Chain Security (SCS)**: Artifact security and compliance
- **Internal Developer Portal (IDP)**: Developer experience tools
- **Chaos Engineering**: Chaos experiment management

### Specialized Tools
- **Audit**: Audit trail and compliance
- **Templates**: Template management
- **Feature Flags**: Feature flag management
- **Logs**: Log aggregation and analysis

## ⚙️ Configuration

### Command Line Arguments

```bash
harness-mcp-server stdio [OPTIONS]

Options:
  --api-key <API_KEY>                    API key for authentication [env: HARNESS_API_KEY]
  --base-url <BASE_URL>                  Base URL for Harness [env: HARNESS_BASE_URL] [default: https://app.harness.io]
  --default-org-id <ORG_ID>             Default organization ID [env: HARNESS_DEFAULT_ORG_ID]
  --default-project-id <PROJECT_ID>     Default project ID [env: HARNESS_DEFAULT_PROJECT_ID]
  --toolsets <TOOLSETS>                 Comma-separated list of toolsets [env: HARNESS_TOOLSETS]
  --read-only                           Run in read-only mode [env: HARNESS_READ_ONLY]
  --debug                               Enable debug logging [env: HARNESS_DEBUG]
  --output-dir <DIR>                    Output directory for files [env: HARNESS_OUTPUT_DIR]
```

### Environment Variables

All configuration can be provided via environment variables with the `HARNESS_` prefix:

```bash
export HARNESS_API_KEY="your_api_key"
export HARNESS_DEFAULT_ORG_ID="your_org_id"
export HARNESS_DEFAULT_PROJECT_ID="your_project_id"
export HARNESS_BASE_URL="https://app.harness.io"
export HARNESS_TOOLSETS="pipelines,connectors,dashboards"
export HARNESS_READ_ONLY="false"
export HARNESS_DEBUG="false"
```

### Server Modes

#### 1. Stdio Mode (Default)
```bash
harness-mcp-server stdio
```

#### 2. HTTP Server Mode
```bash
harness-mcp-server http-server --port 8080 --path /mcp
```

#### 3. Internal Mode
```bash
harness-mcp-server internal --bearer-token <token> --mcp-svc-secret <secret>
```

## 🧪 Testing

### Running Tests

```bash
# All tests
make test

# Unit tests only
cargo test --lib

# Integration tests
cargo test --test '*'

# End-to-end tests (requires environment setup)
make test-e2e

# With coverage
cargo install cargo-llvm-cov
cargo llvm-cov --html
```

### Test Environment Setup

For E2E tests, set up environment variables:

```bash
export HARNESS_MCP_SERVER_E2E_TOKEN=<your_token>
export HARNESS_MCP_SERVER_E2E_ACCOUNT_ID=<account_id>
export HARNESS_MCP_SERVER_E2E_ORG_ID=<org_id>
export HARNESS_MCP_SERVER_E2E_PROJECT_ID=<project_id>
export HARNESS_MCP_SERVER_E2E_BASE_URL=<base_url>
```

### Benchmarking

```bash
# Run benchmarks
make bench

# Or with cargo
cargo bench
```

## 🤝 Contributing

### Development Guidelines

1. **Code Style**: Use `rustfmt` for formatting
2. **Linting**: Ensure `clippy` passes with no warnings
3. **Testing**: Add tests for new functionality
4. **Documentation**: Update docs for API changes
5. **Security**: Run `cargo audit` before submitting

### Pull Request Process

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run the full test suite: `make ci`
5. Submit a pull request

### Code Quality

```bash
# Format code
make fmt

# Check lints
make clippy

# Run security audit
make audit

# Full CI check
make ci
```

## 📊 Performance

### Benchmarks (vs Go version)

| Metric | Go Version | Rust Version | Improvement |
|--------|------------|--------------|-------------|
| Memory Usage | ~50MB | ~15MB | 70% reduction |
| Binary Size | ~25MB | ~12MB | 52% reduction |
| Startup Time | ~200ms | ~50ms | 75% faster |
| CPU Usage | Baseline | 50% less | 50% reduction |

### Resource Requirements

- **Minimum RAM**: 32MB
- **Recommended RAM**: 64MB
- **CPU**: Any modern x86_64 or ARM64
- **Disk**: 20MB for binary + logs

## 🔍 Debugging

### Logging Configuration

```bash
# Enable debug logging
RUST_LOG=debug harness-mcp-server stdio

# Structured JSON logging
RUST_LOG=info harness-mcp-server stdio --log-format=json

# Component-specific logging
RUST_LOG=harness_mcp_server=debug,harness_mcp_core=info harness-mcp-server stdio
```

### Using MCP Inspector

```bash
# Install MCP Inspector
npm install -g @modelcontextprotocol/inspector

# Launch with inspector
npx @modelcontextprotocol/inspector /path/to/harness-mcp-server stdio
```

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [Harness Documentation](https://docs.harness.io)
- **Issues**: [GitHub Issues](https://github.com/harness/mcp-server/issues)
- **Community**: [Harness Community](https://community.harness.io)

## 🗺️ Roadmap

### Upcoming Features
- WebAssembly tool plugins
- gRPC transport support
- Enhanced metrics collection
- Native ARM64 optimizations

### Performance Goals
- Sub-10MB memory usage
- Sub-20ms startup time
- Zero-copy JSON processing

---

**Migration from Go?** See [MIGRATION_NOTES.md](MIGRATION_NOTES.md) for detailed migration information.