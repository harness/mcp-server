# HTTP Server Endpoints and Route Structure

## Overview

The Harness MCP Server provides an HTTP transport mode that serves the Model Context Protocol (MCP) over HTTP using JSON-RPC 2.0. This mode is designed for web-based integrations and internal service communication.

## Server Configuration

### HTTP Server Settings
- **Default Port**: 8080 (configurable via `--http-port` or `MCP_HTTP_PORT`)
- **Default Path**: `/mcp` (configurable via `--http-path` or `MCP_HTTP_PATH`)
- **Protocol**: HTTP/1.1 with JSON-RPC 2.0 over HTTP
- **Content-Type**: `application/json`

### Server Startup
```bash
harness-mcp-server http-server \
  --http-port 8080 \
  --http-path /mcp \
  --bearer-token "your-jwt-token" \
  --mcp-svc-secret "your-secret"
```

## Route Structure

### Primary MCP Endpoint

**Route**: `POST {configured-path}` (default: `POST /mcp`)

This single endpoint handles all MCP protocol communication using JSON-RPC 2.0 messages. The server uses a streamable HTTP transport that maintains the MCP protocol semantics over HTTP.

**Request Format**:
```http
POST /mcp HTTP/1.1
Host: localhost:8080
Content-Type: application/json
Authorization: Bearer <jwt-token>

{
  "jsonrpc": "2.0",
  "id": "request-id",
  "method": "method_name",
  "params": {
    // Method-specific parameters
  }
}
```

**Response Format**:
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": "request-id",
  "result": {
    // Method-specific result
  }
}
```

## Authentication Middleware

### Bearer Token Authentication

The HTTP server uses JWT bearer token authentication for all requests:

**Header Format**:
```http
Authorization: Bearer <jwt-token>
```

**Authentication Flow**:
1. Extract `Authorization` header from request
2. Validate format: `Bearer <token>`
3. Authenticate JWT token using configured secret (`mcp-svc-secret`)
4. Extract user session from JWT claims
5. Add authenticated session and scope to request context
6. Forward request to MCP handler

**JWT Claims Structure**:
```json
{
  "accountId": "account-identifier",
  "email": "user@example.com", 
  "username": "username",
  "exp": 1234567890,
  "iat": 1234567890
}
```

### Authentication Errors

**401 Unauthorized** responses for:
- Missing Authorization header
- Invalid header format (not "Bearer <token>")
- Invalid or expired JWT token
- Token authentication failure

## MCP Protocol Methods

All MCP protocol methods are accessible through the single HTTP endpoint:

### Core Protocol Methods
- `initialize` - Initialize MCP connection
- `tools/list` - List available tools
- `tools/call` - Execute a tool
- `prompts/list` - List available prompts
- `prompts/get` - Get a specific prompt
- `resources/list` - List available resources
- `resources/read` - Read a specific resource

### Example HTTP Requests

#### Initialize Connection
```http
POST /mcp HTTP/1.1
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": {},
      "resources": {},
      "prompts": {}
    },
    "clientInfo": {
      "name": "web-client",
      "version": "1.0.0"
    }
  }
}
```

#### List Tools
```http
POST /mcp HTTP/1.1
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

{
  "jsonrpc": "2.0",
  "id": "2", 
  "method": "tools/list",
  "params": {}
}
```

#### Call Tool
```http
POST /mcp HTTP/1.1
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

{
  "jsonrpc": "2.0",
  "id": "3",
  "method": "tools/call",
  "params": {
    "name": "list_pipelines",
    "arguments": {
      "org_id": "default",
      "project_id": "default_project",
      "page": 0,
      "limit": 10
    }
  }
}
```

## Server Architecture

### HTTP Server Stack
```
HTTP Request
    ↓
Authentication Middleware (JWT validation)
    ↓
Scope Context Injection
    ↓
MCP Streamable HTTP Server
    ↓
MCP Protocol Handler
    ↓
Tool/Prompt/Resource Handlers
    ↓
Harness API Clients
```

### Middleware Components

1. **Authentication Middleware** (`auth.AuthMiddleware`)
   - Validates JWT bearer tokens
   - Extracts user session from token claims
   - Adds authentication context to request

2. **Scope Context Middleware** (built into auth)
   - Extracts account ID from authenticated session
   - Creates scope context for tool execution
   - Provides org/project scope resolution

3. **MCP Protocol Middleware** (from mcp-go library)
   - Handles JSON-RPC 2.0 protocol
   - Routes MCP method calls to appropriate handlers
   - Manages protocol capabilities and versioning

## Server Configuration

### Environment Variables
```bash
# HTTP Server Configuration
MCP_HTTP_PORT=8080                    # HTTP server port
MCP_HTTP_PATH=/mcp                    # HTTP endpoint path

# Authentication Configuration  
HARNESS_MCP_SVC_SECRET=your-secret    # JWT validation secret
HARNESS_BEARER_TOKEN=your-jwt-token   # Default bearer token

# Transport Configuration
HARNESS_TRANSPORT=http                # Enable HTTP transport mode
```

### Command Line Flags
```bash
--http-port int       HTTP server port (default 8080)
--http-path string    HTTP server path (default "/mcp")
--bearer-token string Bearer token for authentication
--mcp-svc-secret string Secret for JWT validation
--transport string    Transport type (http, stdio, internal)
```

## Error Handling

### HTTP Status Codes
- **200 OK**: Successful MCP request/response
- **400 Bad Request**: Invalid JSON-RPC request format
- **401 Unauthorized**: Authentication failure
- **500 Internal Server Error**: Server-side processing error

### JSON-RPC Error Responses
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": "request-id",
  "error": {
    "code": -32000,
    "message": "Tool execution failed",
    "data": {
      "type": "ToolError",
      "details": "Pipeline not found"
    }
  }
}
```

## Security Considerations

### Authentication Security
- JWT tokens must be signed with configured secret
- Tokens should include expiration times
- Account ID extracted from token claims for authorization

### Transport Security
- HTTPS recommended for production deployments
- Bearer tokens transmitted in Authorization headers
- No sensitive data in URL parameters

### Request Validation
- All requests validated against JSON-RPC 2.0 specification
- Tool parameters validated against input schemas
- Scope-based authorization for resource access

## Monitoring and Logging

### Request Logging
- All HTTP requests logged with method, path, status
- Authentication events logged (success/failure)
- MCP method calls logged with tool names and parameters

### Health Monitoring
- Server startup/shutdown events logged
- Connection establishment logged with client info
- Error conditions logged with context

### Metrics
- Request count and response times
- Authentication success/failure rates
- Tool execution statistics

## Integration Examples

### Web Client Integration
```javascript
// Example web client using fetch API
async function callMCPTool(method, params) {
  const response = await fetch('/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwtToken}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: generateId(),
      method: method,
      params: params
    })
  });
  
  return await response.json();
}

// List available tools
const tools = await callMCPTool('tools/list', {});

// Call a specific tool
const result = await callMCPTool('tools/call', {
  name: 'list_pipelines',
  arguments: {
    org_id: 'default',
    project_id: 'my-project'
  }
});
```

### Service-to-Service Integration
```bash
# Internal service calling MCP server
curl -X POST http://mcp-server:8080/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -d '{
    "jsonrpc": "2.0",
    "id": "service-request-1",
    "method": "tools/call",
    "params": {
      "name": "get_pipeline",
      "arguments": {
        "org_id": "production",
        "project_id": "backend-services",
        "pipeline_id": "deploy-pipeline"
      }
    }
  }'
```

## Deployment Considerations

### Container Deployment
```dockerfile
# Example Dockerfile usage
EXPOSE 8080
CMD ["harness-mcp-server", "http-server", \
     "--http-port", "8080", \
     "--http-path", "/mcp"]
```

### Load Balancing
- HTTP server supports multiple concurrent connections
- Stateless design allows horizontal scaling
- Session state maintained in JWT tokens

### Reverse Proxy Configuration
```nginx
# Example nginx configuration
location /mcp {
    proxy_pass http://mcp-server:8080/mcp;
    proxy_set_header Host $host;
    proxy_set_header Authorization $http_authorization;
    proxy_set_header Content-Type application/json;
}
```

This HTTP server implementation provides a robust, scalable way to expose MCP protocol functionality over HTTP while maintaining security and protocol compliance.