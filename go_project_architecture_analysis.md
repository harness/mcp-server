# Go Project Architecture Analysis for Rust Migration

## Project Overview
The Harness MCP Server is a comprehensive Go application that provides Model Context Protocol (MCP) integration with the Harness platform. The project follows a modular architecture with clear separation of concerns.

## Directory Structure Analysis

### Root Level Structure
```
harness-mcp/
├── cmd/                    # Command-line applications
├── pkg/                    # Internal packages and libraries
├── client/                 # API client library
├── test/                   # Test files and utilities
├── go.mod                  # Go module definition
├── go.sum                  # Dependency checksums
├── Makefile               # Build automation
├── Dockerfile             # Container configuration
└── README.md              # Project documentation
```

## Core Components Analysis

### 1. Command Layer (`cmd/`)
**Location**: `cmd/harness-mcp-server/`
**Purpose**: Main application entry point and CLI interface

#### Key Files:
- `main.go` (18,797 bytes): Primary application entry point
- `config/config.go` (1,811 bytes): Configuration structure definitions

#### Architecture:
- **CLI Framework**: Cobra for command-line interface
- **Configuration**: Viper for configuration management
- **Commands**: 
  - `stdio`: External mode with API key authentication
  - `internal`: Internal mode with bearer token authentication
- **Logging**: Structured logging with slog
- **Signal Handling**: Graceful shutdown with context cancellation

### 2. Core Package Layer (`pkg/`)
**Location**: `pkg/harness/`
**Purpose**: Core business logic and MCP server implementation

#### Key Components:

##### Server Implementation (`pkg/harness/`)
- `server.go` (576 bytes): MCP server factory and configuration
- `tools.go` (14,279 bytes): Tool registration and management
- `tools_test.go` (3,715 bytes): Tool testing utilities

##### Tool Implementations (`pkg/harness/tools/`)
**37 tool files** implementing hundreds of individual tools:

**Major Tool Categories:**
- **Supply Chain Security (SCS)**: `scs.go` (49,161 bytes)
- **Cloud Cost Management**: 
  - `ccmperspectives.go` (33,043 bytes)
  - `ccmgraphqlperspectives.go` (23,285 bytes)
  - `ccmcosts.go` (22,541 bytes)
  - `ccmrecommendations.go` (18,435 bytes)
  - `ccmcommitments.go` (11,624 bytes)
- **Security Testing Orchestration**: `sto.go` (28,777 bytes)
- **Core Platform Tools**:
  - `pipelines.go` (14,226 bytes)
  - `pullreq.go` (14,367 bytes)
  - `idp.go` (14,398 bytes)
  - `connectors.go` (12,001 bytes)
- **Infrastructure & Environment**:
  - `environments.go` (9,919 bytes)
  - `infrastructure.go` (9,552 bytes)
- **Specialized Services**:
  - `chaos.go` (4,882 bytes)
  - `templates.go` (4,658 bytes)
  - `logs.go` (3,971 bytes)

##### Authentication (`pkg/harness/auth/`)
- JWT token handling
- API key authentication
- Bearer token management
- Session context management

##### Prompts (`pkg/harness/prompts/`)
- `prompts.go` (4,266 bytes): Prompt definitions and registration
- `fetcher.go` (1,474 bytes): Prompt fetching utilities
- `file_loader.go` (2,146 bytes): File-based prompt loading

##### Event System (`pkg/harness/event/`)
- Event handling and processing
- Async event management

##### Data Transfer Objects (`pkg/harness/dto/`)
- Type definitions for API responses
- Serialization/deserialization structures

#### Module System (`pkg/modules/`)
**Purpose**: Licensing and feature management

**Key Files:**
- `module.go` (1,549 bytes): Module interface definition
- `registry.go` (5,983 bytes): Module registration and management
- Individual module implementations:
  - `core.go` (15,316 bytes): Core platform features
  - `ccm.go` (5,049 bytes): Cloud Cost Management
  - `cd.go` (4,598 bytes): Continuous Delivery
  - `code.go` (3,907 bytes): Code repository features
  - `chaos.go` (2,607 bytes): Chaos Engineering
  - `idp.go` (3,219 bytes): Internal Developer Portal
  - `ssca.go` (3,125 bytes): Supply Chain Security
  - `sto.go` (3,450 bytes): Security Testing

#### Toolset Management (`pkg/toolsets/`)
- `toolsets.go` (3,953 bytes): Toolset organization and management
- Read/write tool separation
- Dynamic toolset enabling/disabling
- Scope-based access control

### 3. Client Library (`client/`)
**Purpose**: Harness API client implementation

#### Architecture:
- **Base Client**: `client.go` (15,444 bytes)
  - HTTP client with retry logic
  - Authentication provider integration
  - Request/response handling
  - Error management

#### Service Clients:
- `pipelines.go` (9,471 bytes): Pipeline API client
- `ccmgraphqlperspectives.go` (8,438 bytes): CCM GraphQL client
- `ccmcosts.go` (9,531 bytes): Cost management client
- `idp.go` (6,242 bytes): Internal Developer Portal client
- `intelligence.go` (7,000 bytes): Intelligence service client
- `genai.go` (6,635 bytes): GenAI service client
- `pullrequest.go` (6,266 bytes): Pull request client
- `dashboard.go` (5,282 bytes): Dashboard client
- `connectors.go` (4,799 bytes): Connector client

#### Data Transfer Objects (`client/dto/`)
**29 DTO files** defining API data structures:
- `pipeline.go` (18,459 bytes): Pipeline data structures
- `connectors.go` (12,530 bytes): Connector definitions
- `accessControl.go` (12,010 bytes): RBAC structures
- `ccmgraphqlperspectives.go` (11,710 bytes): CCM GraphQL types
- `pullrequest.go` (9,537 bytes): Pull request structures
- `idp.go` (9,436 bytes): IDP data types

#### Generated Clients:
- `ar/ar_gen.go` (351,952 bytes): Artifact Registry generated client
- `scs/generated/scs.gen.go` (97,533 bytes): SCS generated client
- `sto/generated/sto.gen.go` (66,932 bytes): STO generated client
- `dbops/generated/dbops_gen.go` (34,705 bytes): Database Operations client

### 4. Testing Infrastructure (`test/`)
- End-to-end test configurations
- Integration test utilities
- Test data and fixtures

## API Architecture Analysis

### 1. RESTful API Integration
- **Base URL**: Configurable (default: https://app.harness.io)
- **Authentication**: Multiple methods (API key, Bearer token, service secrets)
- **HTTP Methods**: GET, POST, PUT, DELETE
- **Content Type**: JSON
- **Error Handling**: Structured error responses

### 2. GraphQL Integration
- **CCM GraphQL**: Complex cost management queries
- **Query Building**: Dynamic query construction
- **Response Processing**: Structured data extraction

### 3. Service-Oriented Architecture
**Internal Services** (20+ services):
- Pipeline Service
- NG Manager
- Chatbot Service
- GenAI Service
- Artifact Registry
- NextGen CE
- CCM Commitment Orchestration
- IDP Service
- Chaos Manager
- Template Service
- Intelligence Service
- Code Service
- Log Service
- SCS Service
- STO Service
- Audit Service
- Database Operations
- RBAC Service

### 4. API Endpoints Catalog

#### Core Platform APIs:
- **Pipelines**: CRUD operations, executions, summaries
- **Connectors**: Catalog, management, details
- **Services**: Service definitions and management
- **Environments**: Environment configuration
- **Infrastructure**: Infrastructure definitions

#### Advanced Platform APIs:
- **Cloud Cost Management**: 
  - Cost perspectives and analysis
  - Recommendations and optimization
  - Commitment analysis
  - Budget management
- **Supply Chain Security**:
  - Artifact scanning and analysis
  - SBOM generation
  - Compliance checking
  - Chain of custody tracking
- **Security Testing Orchestration**:
  - Vulnerability scanning
  - Security issue management
  - Exemption workflows

#### Developer Experience APIs:
- **Internal Developer Portal**:
  - Entity catalog management
  - Scorecard systems
  - Score tracking
- **Pull Requests**: PR management and automation
- **Repositories**: Repository operations
- **Templates**: Template management and search

#### Operational APIs:
- **Dashboards**: Dashboard data and visualization
- **Logs**: Log retrieval and management
- **Audit**: Audit trail access
- **Settings**: Platform configuration
- **Access Control**: RBAC management

## Core Functionality Analysis

### 1. MCP Protocol Implementation
- **JSON-RPC 2.0**: Over stdin/stdout
- **Tool Registration**: Dynamic tool discovery and registration
- **Prompt System**: AI guidance and templates
- **Resource Management**: File and data resource handling
- **Capability Negotiation**: Client-server capability exchange

### 2. Tool System Architecture
- **Tool Interface**: Standardized tool definition
- **Parameter Validation**: Type-safe parameter handling
- **Scope Management**: Account/org/project level access
- **Read/Write Separation**: Permission-based tool access
- **Error Handling**: Structured error responses

### 3. Configuration Management
- **Environment Variables**: HARNESS_ prefixed configuration
- **CLI Flags**: Comprehensive flag system
- **File Configuration**: YAML/JSON configuration support
- **Validation**: Configuration validation and defaults

### 4. Authentication & Authorization
- **API Key Authentication**: External mode authentication
- **Bearer Token**: Internal mode authentication
- **Service Secrets**: Inter-service authentication
- **Scope Validation**: Resource-level access control
- **Session Management**: Context-based session handling

### 5. Async Processing
- **Goroutines**: Concurrent request processing
- **Channels**: Inter-goroutine communication
- **Context Propagation**: Request context management
- **Timeout Handling**: Request timeout management
- **Retry Logic**: Exponential backoff retry

### 6. Error Handling Patterns
- **Error Wrapping**: Context-preserving error chains
- **Structured Errors**: Typed error responses
- **HTTP Status Mapping**: Status code to error mapping
- **Logging Integration**: Error logging and tracking

## Data Flow Architecture

### 1. Request Flow
```
CLI Input → Cobra Parser → Viper Config → MCP Server → Tool Router → API Client → Harness API
```

### 2. Response Flow
```
Harness API → HTTP Client → DTO Mapping → Tool Processing → MCP Response → JSON-RPC → stdout
```

### 3. Authentication Flow
```
API Key/Token → Auth Provider → HTTP Headers → Service Authentication → API Access
```

### 4. Tool Execution Flow
```
MCP Request → Parameter Validation → Scope Check → Tool Execution → API Call → Response Processing
```

## Key Migration Considerations for Rust

### 1. **Architectural Strengths to Preserve**
- Modular design with clear separation of concerns
- Comprehensive tool system with scope management
- Flexible authentication and authorization
- Robust error handling and logging
- Extensive API coverage

### 2. **Go-Specific Patterns to Migrate**
- **Goroutines → Tokio async/await**: Concurrent processing
- **Channels → async channels**: Inter-task communication
- **Interface{} → Trait objects**: Dynamic typing
- **Error returns → Result types**: Error handling
- **Viper → config crates**: Configuration management

### 3. **Performance Opportunities**
- **Memory efficiency**: Rust's zero-cost abstractions
- **Type safety**: Compile-time error prevention
- **Async performance**: Tokio's efficient async runtime
- **Serialization**: Faster JSON processing with serde

### 4. **Complexity Areas**
- **Generated clients**: Large generated code files need careful migration
- **GraphQL integration**: Complex query building and response handling
- **Tool system**: Hundreds of tools with complex parameter validation
- **Module licensing**: Dynamic feature enabling based on licenses

### 5. **API Compatibility Requirements**
- **Identical endpoints**: All API calls must remain the same
- **Same request/response formats**: JSON structures must match
- **Authentication compatibility**: All auth methods must work
- **Error response compatibility**: Error formats must match

This architecture analysis reveals a sophisticated, well-structured Go application with extensive API integration, complex tool systems, and robust authentication mechanisms. The Rust migration must preserve all functionality while leveraging Rust's safety and performance benefits.