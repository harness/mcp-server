# Go Project Architecture Analysis

## Project Overview
This is a Harness MCP (Model Context Protocol) server written in Go 1.23. The project provides a bridge between AI assistants and Harness APIs, enabling advanced automation and interaction capabilities.

## Directory Structure

```
harness-mcp/
├── cmd/                          # Application entry points
│   └── harness-mcp-server/       # Main server application
│       ├── config/               # Configuration management
│       └── main.go              # Application entry point
├── pkg/                         # Core packages
│   ├── ccmcommons/              # Cloud Cost Management commons
│   ├── harness/                 # Core Harness integration
│   │   ├── auth/                # Authentication modules
│   │   ├── common/              # Common utilities
│   │   ├── dto/                 # Data Transfer Objects
│   │   ├── event/               # Event handling
│   │   ├── middleware/          # HTTP middleware
│   │   ├── prompts/             # Prompt management
│   │   └── tools/               # Tool implementations
│   ├── modules/                 # Feature modules
│   ├── prompts/                 # Prompt registry
│   ├── resources/               # Embedded resources
│   ├── toolsets/                # Tool grouping
│   └── utils/                   # Utility functions
├── client/                      # Client libraries
├── test/                        # Test files
├── go.mod                       # Go module definition
├── go.sum                       # Go module checksums
├── Makefile                     # Build automation
└── README.md                    # Project documentation
```

## Core Components

### 1. Main Application (`cmd/harness-mcp-server/`)
- **main.go**: Entry point with CLI using Cobra framework
- **config/**: Configuration management with Viper
- Supports two modes:
  - `stdio`: External mode with API key authentication
  - `internal`: Internal mode with bearer token authentication

### 2. Core Harness Package (`pkg/harness/`)

#### Authentication (`auth/`)
- **api_key.go**: API key extraction and validation
- **jwt.go**: JWT token handling
- **session.go**: Session management
- **auth.go**: Authentication interface

#### Tools (`tools/`)
Extensive collection of tool implementations:
- **pipelines.go**: Pipeline management
- **pullreq.go**: Pull request operations
- **repositories.go**: Repository management
- **connectors.go**: Connector operations
- **dashboards.go**: Dashboard access
- **ccm*.go**: Cloud Cost Management tools
- **chaos.go**: Chaos engineering
- **idp.go**: Internal Developer Portal
- **scs.go**: Supply Chain Security
- **sto.go**: Security Test Orchestration
- And many more...

#### Common Utilities (`common/`)
- **scope.go**: Scope management for Harness resources

#### Data Transfer Objects (`dto/`)
- **connectors.go**: Connector data structures

#### Event Handling (`event/`)
- **event.go**: Event management
- **types/**: Event type definitions

#### Middleware (`middleware/`)
- **account_middleware.go**: Account-based request processing

#### Prompts (`prompts/`)
- **prompts.go**: Prompt management system
- **fetcher.go**: Prompt fetching logic
- **file_loader.go**: File-based prompt loading
- **files/**: Prompt template files

### 3. Modules System (`pkg/modules/`)
Modular architecture with feature-specific modules:
- **core.go**: Core functionality
- **ccm.go**: Cloud Cost Management
- **cd.go**: Continuous Deployment
- **ci.go**: Continuous Integration
- **code.go**: Code repository management
- **chaos.go**: Chaos engineering
- **idp.go**: Internal Developer Portal
- **sto.go**: Security Test Orchestration
- **ssca.go**: Software Supply Chain Assurance
- And more...

### 4. Toolsets (`pkg/toolsets/`)
- **toolsets.go**: Tool grouping and management

### 5. Resources (`pkg/resources/`)
- **embed.go**: Embedded resource management
- **templates/**: Template files (OPA policies, etc.)

## Key Dependencies (from go.mod)

### Core Framework
- `github.com/mark3labs/mcp-go v0.34.0` - MCP protocol implementation
- `github.com/spf13/cobra v1.8.0` - CLI framework
- `github.com/spf13/viper v1.18.2` - Configuration management

### Harness Integration
- `github.com/harness/harness-go-sdk v0.5.12` - Official Harness SDK

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
- `github.com/daixiang0/gci v0.13.7` - Go import formatting
- `golang.org/x/tools v0.24.0` - Go development tools

## Architecture Patterns

### 1. Modular Design
- Feature-based modules with clear separation
- Each module can be enabled/disabled independently
- Module registry for dynamic loading

### 2. Tool-based Architecture
- Each Harness service has dedicated tool implementations
- Tools are grouped into logical toolsets
- Consistent interface across all tools

### 3. Configuration Management
- Environment variable support with `HARNESS_` prefix
- CLI flag support via Cobra
- Viper for unified configuration handling

### 4. Authentication Strategy
- Multiple authentication methods (API key, JWT, session)
- Account-based middleware for request processing
- Support for both external and internal modes

### 5. Error Handling
- Standard Go error handling patterns
- Structured logging with slog
- Recovery middleware for panic handling

### 6. Resource Management
- Embedded resources for templates and prompts
- File-based prompt loading system
- Template engine for dynamic content

## Build System
- **Makefile**: Provides build automation
- **Go modules**: Dependency management
- **Tools integration**: goimports, gci for code formatting
- **Testing**: Built-in test runner with coverage

## Testing Strategy
- Unit tests with testify framework
- E2E tests for integration validation
- Test files co-located with source code
- Coverage reporting

## Key Features
1. **Multi-service Integration**: Supports 15+ Harness services
2. **Flexible Authentication**: Multiple auth methods
3. **Modular Architecture**: Enable/disable features as needed
4. **Rich Toolset**: 100+ tools across different domains
5. **Prompt Management**: Dynamic prompt system
6. **Configuration Flexibility**: Environment variables and CLI flags
7. **Robust Error Handling**: Comprehensive error management
8. **Extensible Design**: Easy to add new tools and modules

This architecture provides a solid foundation for the Rust migration, with clear separation of concerns and well-defined interfaces.