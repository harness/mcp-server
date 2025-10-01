# MCP Protocol Documentation

## Overview

The Harness MCP Server implements the Model Context Protocol (MCP) specification, providing a standardized way for AI models to interact with Harness platform resources through tools, prompts, and resources.

## Transport Layers

### 1. Standard I/O Transport (stdio)
- **Protocol**: JSON-RPC 2.0 over stdin/stdout
- **Usage**: Direct communication with MCP clients
- **Authentication**: API key-based authentication
- **Command**: `harness-mcp-server stdio`

### 2. HTTP Transport
- **Protocol**: JSON-RPC 2.0 over HTTP
- **Default Port**: 8080
- **Default Path**: `/mcp`
- **Authentication**: Bearer token or API key
- **Command**: `harness-mcp-server http-server`

### 3. Internal Transport
- **Protocol**: JSON-RPC 2.0 over stdin/stdout
- **Usage**: Internal service-to-service communication
- **Authentication**: Bearer token with JWT validation
- **Command**: `harness-mcp-server internal`

## JSON-RPC 2.0 Message Structure

### Base Message Format
```json
{
  "jsonrpc": "2.0",
  "id": "unique-request-id",
  "method": "method_name",
  "params": {
    // Method-specific parameters
  }
}
```

### Response Format
```json
{
  "jsonrpc": "2.0",
  "id": "unique-request-id",
  "result": {
    // Method-specific result data
  }
}
```

### Error Response Format
```json
{
  "jsonrpc": "2.0",
  "id": "unique-request-id",
  "error": {
    "code": -32000,
    "message": "Error description",
    "data": {
      // Additional error details
    }
  }
}
```

## Core MCP Protocol Endpoints

### 1. Initialize
**Method**: `initialize`

**Request**:
```json
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
  "id": "1",
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": {
        "listChanged": true
      },
      "resources": {
        "subscribe": true,
        "listChanged": true
      },
      "prompts": {
        "listChanged": true
      },
      "logging": {}
    },
    "serverInfo": {
      "name": "harness-mcp-server",
      "version": "0.1.0"
    }
  }
}
```

### 2. List Tools
**Method**: `tools/list`

**Request**:
```json
{
  "jsonrpc": "2.0",
  "id": "2",
  "method": "tools/list",
  "params": {}
}
```

**Response**:
```json
{
  "jsonrpc": "2.0",
  "id": "2",
  "result": {
    "tools": [
      {
        "name": "list_pipelines",
        "description": "List pipelines in a project",
        "inputSchema": {
          "type": "object",
          "properties": {
            "org_id": {
              "type": "string",
              "description": "Organization identifier"
            },
            "project_id": {
              "type": "string", 
              "description": "Project identifier"
            },
            "page": {
              "type": "integer",
              "description": "Page number for pagination"
            },
            "limit": {
              "type": "integer",
              "description": "Number of items per page"
            }
          },
          "required": ["org_id", "project_id"]
        }
      }
    ]
  }
}
```

### 3. Call Tool
**Method**: `tools/call`

**Request**:
```json
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

**Response**:
```json
{
  "jsonrpc": "2.0",
  "id": "3",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"data\":{\"content\":[{\"identifier\":\"pipeline1\",\"name\":\"My Pipeline\"}]}}"
      }
    ],
    "isError": false
  }
}
```

### 4. List Prompts
**Method**: `prompts/list`

**Request**:
```json
{
  "jsonrpc": "2.0",
  "id": "4",
  "method": "prompts/list",
  "params": {}
}
```

**Response**:
```json
{
  "jsonrpc": "2.0",
  "id": "4",
  "result": {
    "prompts": [
      {
        "name": "harness_guidelines",
        "description": "Guidelines for using Harness tools effectively",
        "arguments": []
      }
    ]
  }
}
```

### 5. Get Prompt
**Method**: `prompts/get`

**Request**:
```json
{
  "jsonrpc": "2.0",
  "id": "5",
  "method": "prompts/get",
  "params": {
    "name": "harness_guidelines",
    "arguments": {}
  }
}
```

**Response**:
```json
{
  "jsonrpc": "2.0",
  "id": "5",
  "result": {
    "description": "Guidelines for using Harness tools effectively",
    "messages": [
      {
        "role": "user",
        "content": {
          "type": "text",
          "text": "When using Harness tools, always specify org_id and project_id..."
        }
      }
    ]
  }
}
```

### 6. List Resources
**Method**: `resources/list`

**Request**:
```json
{
  "jsonrpc": "2.0",
  "id": "6",
  "method": "resources/list",
  "params": {}
}
```

**Response**:
```json
{
  "jsonrpc": "2.0",
  "id": "6",
  "result": {
    "resources": [
      {
        "uri": "harness://pipeline/my-pipeline",
        "name": "My Pipeline",
        "description": "A sample pipeline configuration",
        "mimeType": "application/yaml"
      }
    ]
  }
}
```

### 7. Read Resource
**Method**: `resources/read`

**Request**:
```json
{
  "jsonrpc": "2.0",
  "id": "7",
  "method": "resources/read",
  "params": {
    "uri": "harness://pipeline/my-pipeline"
  }
}
```

**Response**:
```json
{
  "jsonrpc": "2.0",
  "id": "7",
  "result": {
    "contents": [
      {
        "uri": "harness://pipeline/my-pipeline",
        "mimeType": "application/yaml",
        "text": "pipeline:\n  name: My Pipeline\n  stages:\n    - stage:\n        name: Build\n        type: CI"
      }
    ]
  }
}
```

## Tool Input Schema Patterns

### Common Parameters
All tools support these common scope parameters:

```json
{
  "org_id": {
    "type": "string",
    "description": "Organization identifier",
    "default": "default"
  },
  "project_id": {
    "type": "string", 
    "description": "Project identifier",
    "default": "default_project"
  }
}
```

### Pagination Parameters
List operations typically support:

```json
{
  "page": {
    "type": "integer",
    "description": "Page number (0-based)",
    "default": 0
  },
  "limit": {
    "type": "integer",
    "description": "Number of items per page",
    "default": 10,
    "maximum": 100
  }
}
```

### Filter Parameters
Many tools support filtering:

```json
{
  "search_term": {
    "type": "string",
    "description": "Search term to filter results"
  },
  "filter_type": {
    "type": "string",
    "description": "Type of filter to apply",
    "enum": ["active", "inactive", "all"]
  }
}
```

## Authentication Flows

### 1. API Key Authentication (External Mode)
- Used for external client connections
- API key format: `pat.ACCOUNT_ID.TOKEN_ID.HASH`
- Account ID extracted from API key
- Header: `x-api-key: <api-key>`

### 2. Bearer Token Authentication (Internal Mode)
- Used for internal service communication
- JWT token with custom claims
- Claims include: accountId, email, username
- Header: `Authorization: Bearer <jwt-token>`

### 3. HTTP Authentication Middleware
- Validates authentication headers
- Extracts user context
- Adds authentication info to request context

## Error Handling

### Standard Error Codes
- `-32700`: Parse error
- `-32600`: Invalid Request
- `-32601`: Method not found
- `-32602`: Invalid params
- `-32603`: Internal error
- `-32000` to `-32099`: Server error range

### Custom Error Responses
```json
{
  "jsonrpc": "2.0",
  "id": "request-id",
  "error": {
    "code": -32000,
    "message": "Authentication failed",
    "data": {
      "type": "AuthenticationError",
      "details": "Invalid API key format"
    }
  }
}
```

## Content Types

### Text Content
```json
{
  "type": "text",
  "text": "Plain text content"
}
```

### Resource Content
```json
{
  "type": "resource",
  "resource": {
    "uri": "harness://resource/uri",
    "text": "Resource content",
    "mimeType": "application/json"
  }
}
```

## Server Capabilities

The Harness MCP Server supports:

- **Tools**: Dynamic tool registration and execution
- **Resources**: Read-only access to Harness resources
- **Prompts**: Contextual prompts for AI interactions
- **Logging**: Structured logging with configurable levels
- **Sampling**: Request sampling for performance monitoring

## Protocol Versioning

- **Current Version**: `2024-11-05`
- **Backward Compatibility**: Maintained for one major version
- **Version Negotiation**: Handled during initialization

## Security Considerations

1. **Authentication Required**: All requests must be authenticated
2. **Scope Validation**: Tools validate org/project access
3. **Rate Limiting**: Implemented at the HTTP transport layer
4. **Input Validation**: All tool parameters are validated
5. **Error Sanitization**: Sensitive information filtered from errors