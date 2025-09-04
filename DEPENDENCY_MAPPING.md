# Go to Rust Dependency Mapping

This document maps Go dependencies from the original project to their Rust equivalents for the migration.

## Core Dependencies

### MCP Protocol
- **Go**: `github.com/mark3labs/mcp-go v0.34.0`
- **Rust**: No direct equivalent - will need to implement MCP protocol or find/create a Rust MCP library
- **Notes**: This is the core Model Context Protocol library. May need to implement from scratch or port.

### HTTP Client
- **Go**: `github.com/hashicorp/go-retryablehttp v0.7.1`
- **Rust**: `reqwest` with `reqwest-retry` or `reqwest-middleware`
- **Notes**: Reqwest is the standard HTTP client for Rust with retry capabilities via middleware

### JSON Web Tokens
- **Go**: `github.com/golang-jwt/jwt v3.2.2+incompatible`
- **Rust**: `jsonwebtoken` crate
- **Notes**: Standard JWT implementation for Rust

### UUID Generation
- **Go**: `github.com/google/uuid v1.6.0`
- **Rust**: `uuid` crate
- **Notes**: Direct equivalent functionality

### CLI Framework
- **Go**: `github.com/spf13/cobra v1.8.0`
- **Rust**: `clap` crate (v4.x)
- **Notes**: Clap is the most popular CLI framework for Rust with derive macros

### Configuration Management
- **Go**: `github.com/spf13/viper v1.18.2`
- **Rust**: `config` crate or `figment` crate
- **Notes**: For configuration file parsing and environment variable handling

### Testing Framework
- **Go**: `github.com/stretchr/testify v1.10.0`
- **Rust**: Built-in `#[cfg(test)]` and `assert!` macros, plus `mockall` for mocking
- **Notes**: Rust has excellent built-in testing support

### Logging
- **Go**: `github.com/rs/zerolog v1.34.0` and `github.com/sirupsen/logrus v1.9.0`
- **Rust**: `tracing` + `tracing-subscriber` or `log` + `env_logger`
- **Notes**: Tracing is the modern logging framework for Rust

### YAML Processing
- **Go**: `gopkg.in/yaml.v3 v3.0.1`
- **Rust**: `serde_yaml` crate
- **Notes**: Part of the serde ecosystem for serialization

### Backoff/Retry Logic
- **Go**: `github.com/cenkalti/backoff/v4 v4.3.0`
- **Rust**: `backoff` crate or `tokio-retry`
- **Notes**: For exponential backoff and retry logic

## Harness-Specific Dependencies

### Harness SDK
- **Go**: `github.com/harness/harness-go-sdk v0.5.12`
- **Rust**: Will need to create Rust bindings or reimplement API client
- **Notes**: This is Harness-specific and will require custom implementation

### OpenAPI Runtime
- **Go**: `github.com/oapi-codegen/runtime v1.1.1`
- **Rust**: `openapi` crate or manual implementation
- **Notes**: For OpenAPI client generation and runtime support

## Development Tools

### Code Formatting
- **Go**: `github.com/daixiang0/gci v0.13.7` and `golang.org/x/tools v0.24.0`
- **Rust**: `rustfmt` (built-in) and `clippy` (built-in)
- **Notes**: Rust has excellent built-in formatting and linting tools

## Additional Rust Dependencies Needed

### Async Runtime
- **Rust**: `tokio` - For async/await support and runtime
- **Notes**: Essential for async operations in Rust

### Serialization
- **Rust**: `serde` with `serde_json` - For JSON serialization/deserialization
- **Notes**: Standard serialization framework for Rust

### Error Handling
- **Rust**: `anyhow` or `thiserror` - For better error handling
- **Notes**: Improves error handling ergonomics in Rust

### Date/Time
- **Rust**: `chrono` - For date and time operations
- **Notes**: Standard date/time library for Rust

### Environment Variables
- **Rust**: `dotenvy` - For .env file support
- **Notes**: For loading environment variables from files

## Migration Strategy

1. **Phase 1**: Set up basic Rust project structure with core dependencies
2. **Phase 2**: Implement MCP protocol support (may need custom implementation)
3. **Phase 3**: Port Harness API client functionality
4. **Phase 4**: Migrate business logic and toolsets
5. **Phase 5**: Add comprehensive testing and documentation

## Notes

- Some Go dependencies don't have direct Rust equivalents and will require custom implementation
- The MCP protocol library is the biggest challenge as it may need to be implemented from scratch
- Rust's ownership system will require rethinking some patterns used in the Go code
- Async/await patterns in Rust are different from Go's goroutines and channels