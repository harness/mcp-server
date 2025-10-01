# Harness MCP Server API Documentation

## Overview

The Harness MCP (Model Context Protocol) Server provides AI assistants with tools to interact with Harness APIs. It implements the MCP specification and supports both stdio and HTTP transports.

## Transport Modes

### 1. Stdio Transport (Standard MCP)
- **Protocol**: JSON-RPC 2.0 over stdin/stdout
- **Authentication**: API key via command line arguments
- **Usage**: Direct integration with MCP clients

### 2. HTTP Transport
- **Protocol**: JSON-RPC 2.0 over HTTP
- **Endpoint**: Configurable (default: `/mcp` on port 8080)
- **Authentication**: Bearer token in Authorization header
- **Usage**: Web-based integrations and internal services

### 3. Internal Mode
- **Protocol**: JSON-RPC 2.0 over stdio
- **Authentication**: Bearer token with JWT validation
- **Usage**: Internal Harness service communication

## MCP Protocol Endpoints

### Core MCP Methods

#### 1. Initialize
**Method**: `initialize`
**Description**: Initialize the MCP session and exchange capabilities

**Request**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {
      "name": "client-name",
      "version": "1.0.0"
    }
  }
}
```

**Response**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": {}
    },
    "serverInfo": {
      "name": "harness-mcp-server",
      "version": "0.1.0"
    }
  }
}
```

#### 2. List Tools
**Method**: `tools/list`
**Description**: Get list of available tools

**Request**:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list",
  "params": {}
}
```

**Response**:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [
      {
        "name": "list_pipelines",
        "description": "List pipelines in an organization and project",
        "inputSchema": {
          "type": "object",
          "properties": {
            "accountIdentifier": {
              "type": "string",
              "description": "Account identifier"
            },
            "orgIdentifier": {
              "type": "string", 
              "description": "Organization identifier"
            },
            "projectIdentifier": {
              "type": "string",
              "description": "Project identifier"
            },
            "page": {
              "type": "integer",
              "description": "Page number for pagination",
              "default": 0
            },
            "limit": {
              "type": "integer", 
              "description": "Number of items per page",
              "default": 50
            }
          },
          "required": ["accountIdentifier"]
        }
      }
    ]
  }
}
```

#### 3. Call Tool
**Method**: `tools/call`
**Description**: Execute a specific tool

**Request**:
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "list_pipelines",
    "arguments": {
      "accountIdentifier": "account123",
      "orgIdentifier": "org456", 
      "projectIdentifier": "project789",
      "page": 0,
      "limit": 10
    }
  }
}
```

**Response**:
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"status\":\"SUCCESS\",\"data\":{\"totalPages\":1,\"totalItems\":2,\"content\":[{\"identifier\":\"pipeline1\",\"name\":\"Build Pipeline\"}]}}"
      }
    ],
    "isError": false
  }
}
```

## Authentication

### API Key Authentication (External Mode)
- **Header**: `x-api-key: pat.ACCOUNT_ID.TOKEN_ID.SECRET`
- **Format**: Harness Personal Access Token
- **Scope**: Account ID extracted from API key

### Bearer Token Authentication (Internal Mode)
- **Header**: `Authorization: Bearer JWT_TOKEN`
- **Format**: JWT with custom claims
- **Claims**:
  ```json
  {
    "iss": "Harness Inc",
    "iat": 1234567890,
    "exp": 1234567890,
    "type": "USER",
    "name": "user_id",
    "email": "user@example.com",
    "username": "display_name",
    "accountId": "account_id"
  }
  ```

## Tool Categories

### 1. Pipeline Tools
- `list_pipelines` - List pipelines in organization/project
- `get_pipeline` - Get pipeline details by ID
- `list_executions` - List pipeline executions
- `get_execution` - Get execution details
- `fetch_execution_url` - Get execution URL
- `list_input_sets` - List input sets for pipeline
- `get_input_set` - Get input set details

### 2. Dashboard Tools
- `list_dashboards` - List dashboards
- `get_dashboard` - Get dashboard details

### 3. Repository Tools
- `list_repositories` - List repositories
- `get_repository` - Get repository details

### 4. Environment Tools
- `list_environments` - List environments
- `get_environment` - Get environment details
- `move_environment_configs` - Move environment configurations

### 5. Connector Tools
- `list_connectors` - List connectors
- `get_connector` - Get connector details

### 6. Secret Tools
- `list_secrets` - List secrets
- `get_secret` - Get secret details

### 7. Audit Tools
- `list_audit_events` - List audit events
- `get_audit_event` - Get audit event details

### 8. Delegate Token Tools
- `list_delegate_tokens` - List delegate tokens
- `get_delegate_token` - Get delegate token details
- `create_delegate_token` - Create new delegate token
- `revoke_delegate_token` - Revoke delegate token
- `delete_delegate_token` - Delete delegate token

### 9. SEI Efficiency Tools
- `get_efficiency_lead_time` - Get lead time metrics
- `get_deployment_frequency` - Get deployment frequency
- `get_change_failure_rate` - Get change failure rate
- `get_mttr` - Get mean time to recovery
- `get_deployment_frequency_drilldown` - Get deployment frequency drilldown

## Request/Response Schemas

### Common Parameters
All tools support these common scope parameters:
- `accountIdentifier` (required) - Account identifier
- `orgIdentifier` (optional) - Organization identifier
- `projectIdentifier` (optional) - Project identifier

### Pagination Parameters
List operations support:
- `page` (integer, default: 0) - Page number
- `limit` (integer, default: 50) - Items per page
- `sort` (string, optional) - Sort field
- `order` (string, optional) - Sort order (ASC/DESC)

### Standard Response Format
```json
{
  "status": "SUCCESS|ERROR",
  "data": {
    "totalPages": 1,
    "totalItems": 10,
    "pageItemCount": 10,
    "pageSize": 50,
    "content": [...]
  },
  "error": "error message if status is ERROR"
}
```

### Error Response Format
```json
{
  "content": [
    {
      "type": "text",
      "text": "Error message describing what went wrong"
    }
  ],
  "isError": true
}
```

## HTTP Server Configuration

### Endpoints
- **Base Path**: Configurable (default: `/mcp`)
- **Port**: Configurable (default: 8080)
- **Method**: POST for all MCP requests

### Middleware Stack
1. **CORS**: Permissive CORS headers
2. **Tracing**: Request/response logging
3. **Timeout**: 30-second request timeout
4. **Authentication**: Bearer token validation
5. **Scope Extraction**: Extract org/project scope from requests

### Health Check
The server provides basic health checking through the help command:
```bash
./harness-mcp-server --help
```

## External Service Integrations

### Harness Platform Services
The server integrates with 20+ Harness microservices:

1. **Pipeline Service** - Pipeline management
2. **NG Manager** - Core platform management
3. **Chatbot Service** - AI chat functionality
4. **GenAI Service** - AI/ML capabilities
5. **Artifact Registry** - Artifact management
6. **NextGen CE** - Cloud cost management
7. **CCM Comm Orch** - Cost communication orchestration
8. **IDP Service** - Internal developer platform
9. **Chaos Manager** - Chaos engineering
10. **Template Service** - Template management
11. **Intelligence Service** - Analytics and insights
12. **Code Service** - Source code management
13. **Log Service** - Log aggregation
14. **SCS Service** - Supply chain security
15. **STO Service** - Security testing orchestration
16. **SEI Service** - Software engineering insights
17. **Audit Service** - Audit logging
18. **DBOps Service** - Database operations
19. **ACL Service** - Access control

### Service Configuration
Each service requires:
- **Base URL**: Service endpoint URL
- **Secret**: Authentication secret for service-to-service communication

### Rate Limiting
- HTTP client implements retry logic with exponential backoff
- Rate limit handling for 429 responses
- Configurable timeout and retry policies

## Configuration

### Environment Variables
All configuration uses `HARNESS_` prefix:

#### Common Configuration
- `HARNESS_ACCOUNT_ID` - Account identifier
- `HARNESS_API_KEY` - API key for external mode
- `HARNESS_BASE_URL` - Harness platform URL (default: https://app.harness.io)
- `HARNESS_READ_ONLY` - Enable read-only mode
- `HARNESS_DEBUG` - Enable debug logging
- `HARNESS_TOOLSETS` - Comma-separated list of enabled toolsets
- `HARNESS_ENABLE_MODULES` - Comma-separated list of enabled modules

#### HTTP Transport
- `MCP_HTTP_PORT` - HTTP server port (default: 8080)
- `MCP_HTTP_PATH` - HTTP endpoint path (default: /mcp)

#### Internal Mode
- `HARNESS_BEARER_TOKEN` - Bearer token for authentication
- `HARNESS_MCP_SVC_SECRET` - MCP service secret
- Service-specific URLs and secrets for each microservice

### Toolset Configuration
Available toolsets:
- `default` - Core tools (pipelines, dashboards, repositories)
- `pipelines` - Pipeline-specific tools
- `environments` - Environment management tools
- `connectors` - Connector management tools
- `secrets` - Secret management tools
- `audit` - Audit and compliance tools
- `chaos` - Chaos engineering tools
- `security` - Security testing tools
- `cost` - Cloud cost management tools

### Module Configuration
Available modules:
- `core` - Always enabled core functionality
- `ci` - Continuous integration
- `cd` - Continuous deployment
- `ccm` - Cloud cost management
- `chaos` - Chaos engineering
- `security` - Security testing
- `sei` - Software engineering insights

## Error Handling

### Error Types
1. **Authentication Errors** - Invalid API key or bearer token
2. **Authorization Errors** - Insufficient permissions
3. **Validation Errors** - Invalid request parameters
4. **Service Errors** - Downstream service failures
5. **Rate Limit Errors** - Too many requests

### Error Response Format
All errors follow the MCP specification:
```json
{
  "jsonrpc": "2.0",
  "id": "request_id",
  "error": {
    "code": -32603,
    "message": "Internal error: detailed error message"
  }
}
```

### HTTP Status Codes
- `200` - Success
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication errors)
- `403` - Forbidden (authorization errors)
- `429` - Too Many Requests (rate limiting)
- `500` - Internal Server Error (service errors)

## Security

### Authentication Security
- API keys follow Harness PAT format with account ID extraction
- JWT tokens use HS256 signing with service secrets
- Bearer tokens validated against MCP service secret

### Authorization
- Scope-based access control using account/org/project hierarchy
- Read-only mode restricts write operations
- Tool-level permissions based on enabled modules

### Transport Security
- HTTPS recommended for HTTP transport
- Secure stdio transport for direct integrations
- Request/response logging excludes sensitive data

## Performance

### Optimization Features
- Connection pooling for HTTP clients
- Request timeout and retry mechanisms
- Efficient JSON serialization/deserialization
- Async I/O for concurrent request handling

### Monitoring
- Structured logging with configurable levels
- Request tracing and performance metrics
- Error tracking and alerting capabilities
- Health check endpoints for monitoring

## Compatibility

### MCP Specification
- Compliant with MCP specification version 2024-11-05
- JSON-RPC 2.0 protocol implementation
- Standard tool calling interface
- Extensible capability negotiation

### Harness Platform
- Compatible with Harness NextGen platform
- Supports all major Harness modules
- Maintains API compatibility across versions
- Backward compatible with existing integrations