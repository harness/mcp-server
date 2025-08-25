# Go Dependencies Analysis for Rust Migration

## Project Information
- **Module**: `github.com/harness/harness-mcp`
- **Go Version**: 1.23
- **Toolchain**: go1.23.8

## Direct Dependencies (require section)

### Core Framework Dependencies
1. **github.com/spf13/cobra v1.8.0**
   - Purpose: CLI framework for command-line interface
   - Rust equivalent: `clap` (most popular CLI parser for Rust)

2. **github.com/spf13/viper v1.18.2**
   - Purpose: Configuration management (env vars, config files, flags)
   - Rust equivalent: `config` + `serde` + `clap` combination

3. **github.com/mark3labs/mcp-go v0.34.0**
   - Purpose: Model Context Protocol implementation for Go
   - Rust equivalent: Need to find or implement MCP protocol in Rust

### HTTP and Networking
4. **github.com/hashicorp/go-retryablehttp v0.7.1**
   - Purpose: HTTP client with retry logic
   - Rust equivalent: `reqwest` with `reqwest-retry` or custom retry logic

5. **github.com/oapi-codegen/runtime v1.1.1**
   - Purpose: OpenAPI code generation runtime
   - Rust equivalent: `openapi-generator` or `progenitor` for OpenAPI

### Authentication and Security
6. **github.com/golang-jwt/jwt v3.2.2+incompatible**
   - Purpose: JWT token handling
   - Rust equivalent: `jsonwebtoken` crate

### Harness-specific
7. **github.com/harness/harness-go-sdk v0.5.12**
   - Purpose: Harness platform SDK
   - Rust equivalent: Need to port or create Rust SDK for Harness APIs

### Utilities
8. **github.com/google/uuid v1.6.0**
   - Purpose: UUID generation
   - Rust equivalent: `uuid` crate

9. **github.com/cenkalti/backoff/v4 v4.3.0**
   - Purpose: Exponential backoff for retries
   - Rust equivalent: `backoff` crate

### Development Tools
10. **github.com/daixiang0/gci v0.13.7**
    - Purpose: Go import formatting tool
    - Rust equivalent: `rustfmt` (built-in)

11. **golang.org/x/tools v0.24.0**
    - Purpose: Go development tools
    - Rust equivalent: Built-in Rust tooling

### Testing
12. **github.com/stretchr/testify v1.10.0**
    - Purpose: Testing framework with assertions
    - Rust equivalent: Built-in `#[test]` with `assert_eq!` macros

### Data Formats
13. **gopkg.in/yaml.v3 v3.0.1**
    - Purpose: YAML parsing and generation
    - Rust equivalent: `serde_yaml` crate

## Indirect Dependencies (require section - indirect)

### Logging and Observability
- **github.com/rs/zerolog v1.34.0**: Fast JSON logger
  - Rust equivalent: `tracing` + `tracing-subscriber` (more idiomatic)
- **github.com/sirupsen/logrus v1.9.0**: Structured logger
  - Rust equivalent: `log` + `env_logger` or `tracing`

### HTTP and Network Support
- **golang.org/x/net v0.28.0**: Extended networking
  - Rust equivalent: `tokio` provides most networking primitives
- **golang.org/x/oauth2 v0.15.0**: OAuth2 client
  - Rust equivalent: `oauth2` crate

### Concurrency
- **golang.org/x/sync v0.8.0**: Extended sync primitives
  - Rust equivalent: `tokio` + standard library sync primitives
- **go.uber.org/zap v1.24.0**: Fast logger
  - Rust equivalent: `tracing` ecosystem

### Data Processing
- **github.com/mitchellh/mapstructure v1.5.0**: Struct mapping
  - Rust equivalent: `serde` handles this natively
- **github.com/spf13/cast v1.7.1**: Type casting
  - Rust equivalent: Built-in type conversion + `serde`

### File System
- **github.com/spf13/afero v1.11.0**: File system abstraction
  - Rust equivalent: `std::fs` + `tempfile` for testing
- **github.com/fsnotify/fsnotify v1.7.0**: File system notifications
  - Rust equivalent: `notify` crate

## Key Migration Considerations

### 1. MCP Protocol Implementation
- The core dependency `github.com/mark3labs/mcp-go` needs a Rust equivalent
- May need to implement MCP protocol from scratch or find existing Rust implementation

### 2. Harness SDK
- `github.com/harness/harness-go-sdk` needs to be ported to Rust
- This is a significant effort as it contains all Harness API integrations

### 3. Configuration Management
- Go uses Viper for comprehensive config management
- Rust will need combination of `config`, `serde`, and `clap` crates

### 4. HTTP Client Architecture
- Go uses `go-retryablehttp` for resilient HTTP calls
- Rust will use `reqwest` with custom retry middleware

### 5. Async/Concurrency Model
- Go uses goroutines and channels
- Rust will use `tokio` async runtime with async/await

### 6. Error Handling
- Go uses error returns and panic/recover
- Rust uses `Result<T, E>` types with `?` operator

## Recommended Rust Crate Mapping

| Go Package | Purpose | Rust Crate | Notes |
|------------|---------|------------|-------|
| spf13/cobra | CLI framework | clap | Feature-rich CLI parser |
| spf13/viper | Configuration | config + serde | Multi-source config |
| mark3labs/mcp-go | MCP Protocol | **TBD** | Need to implement |
| hashicorp/go-retryablehttp | HTTP + Retry | reqwest + reqwest-retry | HTTP client |
| golang-jwt/jwt | JWT handling | jsonwebtoken | JWT tokens |
| harness/harness-go-sdk | Harness APIs | **TBD** | Need to port |
| google/uuid | UUID generation | uuid | UUID support |
| cenkalti/backoff | Retry backoff | backoff | Exponential backoff |
| stretchr/testify | Testing | Built-in | Rust testing |
| yaml.v3 | YAML parsing | serde_yaml | YAML support |
| rs/zerolog | Logging | tracing | Structured logging |
| golang.org/x/net | Networking | tokio | Async networking |

## Next Steps for Migration
1. Set up Rust project structure with Cargo.toml
2. Implement or find MCP protocol library for Rust
3. Port Harness SDK functionality to Rust
4. Create configuration management system
5. Implement HTTP client with retry logic
6. Set up async runtime with tokio
7. Migrate authentication and JWT handling
8. Port all tool implementations