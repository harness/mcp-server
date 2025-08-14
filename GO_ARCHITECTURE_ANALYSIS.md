# Go Project Architecture Analysis

## Project Overview
**Harness MCP Server** - A Model Context Protocol (MCP) server that provides seamless integration with Harness APIs, enabling advanced automation and interaction capabilities for developers and tools.

## Directory Structure

```
harness-mcp/
├── cmd/
│   └── harness-mcp-server/
│       ├── config/
│       │   └── config.go          # Configuration structures
│       └── main.go                # Main entry point with CLI
├── pkg/
│   ├── harness/
│   │   ├── auth/                  # Authentication layer
│   │   ├── event/                 # Event handling
│   │   ├── tools/                 # Tool implementations
│   │   ├── server.go              # Server setup
│   │   └── tools.go               # Toolset management
│   └── utils/
│       └── utils.go               # Utility functions
├── client/                        # Generated client code
├── test/                          # Test files
├── go.mod                         # Go module definition
├── go.sum                         # Dependency checksums
├── Makefile                       # Build automation
├── Dockerfile                     # Container configuration
└── README.md                      # Project documentation
```

## Core Components

### 1. Main Entry Point (`cmd/harness-mcp-server/main.go`)
- **CLI Framework**: Uses Cobra for command-line interface
- **Configuration**: Viper for configuration management
- **Commands**: 
  - `stdio`: Standard MCP server mode
  - `internal`: Internal mode with additional authentication
- **Environment Variables**: Prefixed with `HARNESS_`
- **Signal Handling**: Graceful shutdown with context cancellation

### 2. Configuration System (`cmd/harness-mcp-server/config/config.go`)
- Centralized configuration structure
- Support for both external (API key) and internal (bearer token) modes
- Service-specific configuration for different Harness services

### 3. Authentication Layer (`pkg/harness/auth/`)
- **API Key Authentication**: For external users
- **JWT Token Handling**: For internal services
- **Session Management**: User session handling
- **Bearer Token Support**: For internal service communication

### 4. Toolset Architecture (`pkg/harness/tools.go` & `pkg/harness/tools/`)
- **Modular Design**: Each service has its own tool file
- **Toolset Groups**: Organized by functionality (pipelines, CCM, STO, etc.)
- **License Validation**: Module-based access control
- **Tool Categories**:
  - Pipelines (pipelines.go)
  - Cloud Cost Management (ccm*.go)
  - Security Test Orchestration (sto.go)
  - Supply Chain Security (scs.go)
  - Internal Developer Portal (idp.go)
  - Chaos Engineering (chaos.go)
  - And many more...

### 5. Event System (`pkg/harness/event/`)
- Event handling for MCP protocol
- Type definitions for different event types
- Simple action and table event types

### 6. Client Layer (`client/`)
- Generated client code for Harness APIs
- Service-specific clients for different Harness modules

## Key Dependencies (from go.mod)

### Core MCP Framework
- `github.com/mark3labs/mcp-go v0.34.0` - MCP protocol implementation

### Harness Integration
- `github.com/harness/harness-go-sdk v0.5.12` - Official Harness SDK

### CLI & Configuration
- `github.com/spf13/cobra v1.8.0` - CLI framework
- `github.com/spf13/viper v1.18.2` - Configuration management

### HTTP & Networking
- `github.com/hashicorp/go-retryablehttp v0.7.1` - Retryable HTTP client
- `github.com/oapi-codegen/runtime v1.1.1` - OpenAPI runtime

### Authentication & Security
- `github.com/golang-jwt/jwt v3.2.2+incompatible` - JWT handling

### Utilities
- `github.com/google/uuid v1.6.0` - UUID generation
- `github.com/cenkalti/backoff/v4 v4.3.0` - Exponential backoff
- `gopkg.in/yaml.v3 v3.0.1` - YAML processing

### Testing
- `github.com/stretchr/testify v1.10.0` - Testing framework

### Development Tools
- `github.com/daixiang0/gci v0.13.7` - Import organization
- `golang.org/x/tools v0.24.0` - Go tools

## Architecture Patterns

### 1. Modular Toolset System
- Each Harness service is implemented as a separate toolset
- Tools are registered dynamically based on configuration
- License-based module enablement for enterprise features

### 2. Configuration-Driven Architecture
- Environment variable based configuration
- Support for both development and production modes
- Service-specific configuration sections

### 3. Client Abstraction
- Service clients abstract HTTP communication
- Consistent error handling across services
- Timeout and retry mechanisms

### 4. Event-Driven Communication
- MCP protocol events for tool execution
- Structured response types (tables, simple actions)

## Service Integration Points

### External Services
- **Harness Platform APIs**: Main integration point
- **Pipeline Service**: CI/CD pipeline management
- **NG Manager**: Core Harness management
- **Cloud Cost Management**: Cost optimization tools
- **Security Services**: STO, SCS for security scanning
- **Internal Developer Portal**: Developer experience tools

### Internal Architecture
- **License Validation**: Enterprise feature gating
- **Authentication Layer**: Multi-mode auth support
- **Tool Registry**: Dynamic tool registration
- **Event Processing**: MCP protocol handling

## Build & Deployment

### Build System
- **Makefile**: Automated build tasks
- **Go Modules**: Dependency management
- **Docker**: Containerized deployment
- **Multi-stage Build**: Optimized container images

### Development Tools
- **Code Formatting**: goimports, gci
- **Testing**: Go test framework with coverage
- **Linting**: Integrated code quality checks

## Error Handling Patterns
- Standard Go error handling with error wrapping
- HTTP status code checking
- Timeout and retry mechanisms
- Graceful degradation for service unavailability

## Concurrency Model
- Context-based cancellation
- Goroutines for concurrent operations
- Channel-based communication where needed
- Signal handling for graceful shutdown

This architecture provides a solid foundation for the Rust migration, with clear separation of concerns and well-defined interfaces between components.