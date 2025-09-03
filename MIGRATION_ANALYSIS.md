# Harness MCP Server - Go to Rust Migration Analysis

## Current Go Architecture Overview

### Project Structure
```
harness-mcp/
├── cmd/harness-mcp-server/     # Main application entry point
│   ├── config/                 # Configuration structures
│   └── main.go                 # CLI and server initialization
├── pkg/                        # Core packages
│   ├── harness/               # Main harness package
│   │   ├── auth/              # Authentication logic
│   │   ├── common/            # Common utilities
│   │   ├── dto/               # Data transfer objects
│   │   ├── event/             # Event handling
│   │   ├── middleware/        # HTTP middleware
│   │   ├── prompts/           # MCP prompts
│   │   ├── tools/             # Tool implementations (38 files)
│   │   ├── server.go          # MCP server creation
│   │   └── tools.go           # Tool registration and management
│   ├── modules/               # Feature modules (17 modules)
│   ├── toolsets/              # Tool grouping logic
│   ├── types/                 # Type definitions
│   └── utils/                 # Utility functions
├── client/                    # Client SDK (36 files)
├── test/                      # Test suites
│   ├── e2e/                   # End-to-end tests
│   └── unit/                  # Unit tests
└── Build files (Makefile, Dockerfile, go.mod)
```

### Core Dependencies (from go.mod)
- **MCP Framework**: `github.com/mark3labs/mcp-go v0.34.0`
- **Harness SDK**: `github.com/harness/harness-go-sdk v0.5.12`
- **CLI Framework**: `github.com/spf13/cobra v1.8.0`
- **Configuration**: `github.com/spf13/viper v1.18.2`
- **HTTP Client**: `github.com/hashicorp/go-retryablehttp v0.7.1`
- **JWT**: `github.com/golang-jwt/jwt v3.2.2+incompatible`
- **UUID**: `github.com/google/uuid v1.6.0`
- **Backoff**: `github.com/cenkalti/backoff/v4 v4.3.0`
- **Testing**: `github.com/stretchr/testify v1.10.0`
- **Logging**: Built-in `log/slog`
- **YAML**: `gopkg.in/yaml.v3 v3.0.1`

### Key Components

#### 1. Server Architecture
- **Transport Modes**: stdio, HTTP, internal
- **MCP Server**: Built on `mark3labs/mcp-go` framework
- **Middleware**: Harness scope injection, authentication
- **Capabilities**: Tools, Resources, Prompts

#### 2. Configuration System
- **Environment Variables**: Prefixed with `HARNESS_`
- **CLI Flags**: Using Cobra + Viper
- **Modes**: External (API key) vs Internal (bearer token + service secrets)
- **Toolset Management**: Configurable tool groups

#### 3. Module System
- **17 Modules**: CORE, CI, CD, CCM, CHAOS, CODE, etc.
- **License-based**: Module availability based on account licenses
- **Dynamic Registration**: Tools registered based on enabled modules

#### 4. Tool Implementation
- **38 Tool Files**: Each implementing specific Harness API functionality
- **Toolsets**: Grouped by functionality (pipelines, pull requests, etc.)
- **Authentication**: API key or bearer token based
- **Error Handling**: Go error patterns with wrapping

#### 5. Client SDK
- **36 Files**: Generated client code for Harness APIs
- **HTTP Client**: Retryable HTTP with backoff
- **Authentication**: Automatic header injection

### Key Functionality Areas

#### Core Tools (Default Toolset)
- Connector management
- Pipeline operations
- Dashboard access
- Basic CRUD operations

#### Specialized Toolsets
- **Pipelines**: Pipeline execution and management
- **Pull Requests**: Code review workflows
- **Repositories**: Repository management
- **Registries**: Artifact registry operations
- **CCM**: Cloud Cost Management
- **Chaos**: Chaos engineering experiments
- **SCS**: Supply Chain Security
- **STO**: Security Test Orchestration
- **IDP**: Internal Developer Portal

### Authentication & Authorization
- **External Mode**: API key extraction (pat.ACCOUNT_ID.TOKEN_ID.*)
- **Internal Mode**: Bearer token + service-specific secrets
- **Session Management**: Context-based authentication
- **Scope Injection**: Middleware for request scoping

### Error Handling Patterns
- **Go Errors**: Standard error wrapping with `fmt.Errorf`
- **HTTP Errors**: Status code handling with retries
- **Logging**: Structured logging with slog
- **Recovery**: Panic recovery in server middleware

### Build & Deployment
- **Makefile**: Build automation with version injection
- **Docker**: Multi-stage build with Alpine base
- **Go Modules**: Dependency management
- **Testing**: Unit and E2E test suites

## Migration Challenges & Considerations

### 1. Dependency Mapping
- **MCP Framework**: Need Rust equivalent or port
- **Harness SDK**: Requires Rust HTTP client implementation
- **CLI Framework**: Clap for Rust
- **Configuration**: Serde + config crates
- **HTTP Client**: reqwest with retry logic
- **Async Runtime**: tokio for async operations

### 2. Architecture Patterns
- **Error Handling**: Go errors → Rust Result<T, E>
- **Null Safety**: Go pointers → Rust Option<T>
- **Memory Management**: GC → Ownership system
- **Concurrency**: Goroutines → async/await + tokio

### 3. Code Generation
- **Client SDK**: 36 files need Rust equivalent
- **OpenAPI**: May need Rust code generation
- **Serialization**: JSON handling with serde

### 4. Testing Strategy
- **Unit Tests**: Rust test framework
- **E2E Tests**: Integration with Harness services
- **Mocking**: Rust mocking libraries

### 5. Performance Considerations
- **Memory Usage**: Rust's zero-cost abstractions
- **Startup Time**: Compiled binary vs Go runtime
- **HTTP Performance**: reqwest vs Go's net/http

## Recommended Migration Strategy

### Phase 1: Foundation
1. Create Rust project structure with Cargo.toml
2. Implement core configuration system
3. Set up logging and error handling
4. Create basic HTTP client with authentication

### Phase 2: Core Components
1. Port MCP server functionality
2. Implement authentication and middleware
3. Create module system architecture
4. Port basic tool implementations

### Phase 3: Tool Migration
1. Migrate core toolset (connectors, pipelines, dashboards)
2. Port specialized toolsets incrementally
3. Implement client SDK equivalents
4. Add comprehensive error handling

### Phase 4: Testing & Validation
1. Port unit tests to Rust
2. Implement E2E test framework
3. Validate API compatibility
4. Performance testing and optimization

### Phase 5: Documentation & Deployment
1. Update documentation for Rust usage
2. Create new build system (Cargo)
3. Update Docker configuration
4. Migration guide for users

## Success Criteria
- [ ] Functional parity with Go implementation
- [ ] API compatibility maintained
- [ ] Performance equal or better than Go version
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Build and deployment working