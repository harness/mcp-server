# Tool Schemas and Parameter Validation Patterns

## Overview

The Harness MCP Server implements a comprehensive tool system with standardized parameter validation patterns, input schemas, and response formats. This document details the schema patterns, validation mechanisms, and common parameter types used across all tools.

## Tool Schema Structure

### Basic Tool Definition Pattern

```go
func ToolName(config *config.Config, client *client.ServiceClient) (tool mcp.Tool, handler server.ToolHandlerFunc) {
    return mcp.NewTool("tool_name",
        mcp.WithDescription("Tool description"),
        // Parameter definitions
        mcp.WithString("param_name", 
            mcp.Required(),
            mcp.Description("Parameter description"),
        ),
        // Common patterns
        common.WithScope(config, true),
        WithPagination(),
    ),
    func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
        // Parameter validation and extraction
        // Business logic
        // Response formatting
    }
}
```

## Parameter Types and Validation

### 1. String Parameters

**Required String Parameter**:
```go
mcp.WithString("pipeline_id",
    mcp.Required(),
    mcp.Description("The ID of the pipeline"),
)

// Validation in handler
pipelineID, err := RequiredParam[string](request, "pipeline_id")
if err != nil {
    return mcp.NewToolResultError(err.Error()), nil
}
```

**Optional String Parameter**:
```go
mcp.WithString("search_term",
    mcp.Description("Optional search term to filter results"),
)

// Validation in handler
searchTerm, err := OptionalParam[string](request, "search_term")
if err != nil {
    return mcp.NewToolResultError(err.Error()), nil
}
```

**String Parameter with Enum Values**:
```go
mcp.WithString("status",
    mcp.Description("Token status (ACTIVE, REVOKED)"),
    mcp.Enum([]string{"ACTIVE", "REVOKED"}),
)
```

### 2. Number Parameters

**Required Number Parameter**:
```go
mcp.WithNumber("pr_number",
    mcp.Required(),
    mcp.Description("Pull request number"),
    mcp.Min(1),
)

// Validation in handler
prNumberFloat, err := RequiredParam[float64](request, "pr_number")
if err != nil {
    return mcp.NewToolResultError(err.Error()), nil
}
prNumber := int(prNumberFloat)
```

**Optional Number with Default and Constraints**:
```go
mcp.WithNumber("limit",
    mcp.DefaultNumber(5),
    mcp.Max(20),
    mcp.Min(1),
    mcp.Description("Number of items per page"),
)
```

### 3. Boolean Parameters

```go
mcp.WithBoolean("recursive",
    mcp.DefaultBoolean(false),
    mcp.Description("Whether to search recursively"),
)

// Validation in handler
recursive, err := OptionalParam[bool](request, "recursive")
if err != nil {
    return mcp.NewToolResultError(err.Error()), nil
}
```

### 4. Object Parameters

```go
mcp.WithObject("filter_properties",
    mcp.Description("Complex filter object"),
    mcp.Properties(map[string]interface{}{
        "type": map[string]interface{}{
            "type": "string",
            "description": "Filter type",
        },
        "values": map[string]interface{}{
            "type": "array",
            "items": map[string]interface{}{
                "type": "string",
            },
        },
    }),
)

// Validation in handler
filterProps, err := OptionalParam[map[string]any](request, "filter_properties")
if err != nil {
    return mcp.NewToolResultError(err.Error()), nil
}
```

## Common Parameter Patterns

### 1. Scope Parameters

**Implementation**:
```go
common.WithScope(config, true) // required=true
```

**Generated Schema**:
```json
{
  "org_id": {
    "type": "string",
    "description": "Required ID of the organization",
    "default": "configured_default_org"
  },
  "project_id": {
    "type": "string", 
    "description": "Required ID of the project",
    "default": "configured_default_project"
  }
}
```

**Validation**:
```go
scope, err := common.FetchScope(config, request, true)
if err != nil {
    return mcp.NewToolResultError(err.Error()), nil
}
```

### 2. Pagination Parameters

**Implementation**:
```go
WithPagination()
```

**Generated Schema**:
```json
{
  "page": {
    "type": "number",
    "description": "Page number for pagination - page 0 is the first page",
    "default": 0,
    "minimum": 0
  },
  "size": {
    "type": "number",
    "description": "Number of items per page", 
    "default": 5,
    "maximum": 20
  }
}
```

**Validation**:
```go
page, size, err := FetchPagination(request)
if err != nil {
    return mcp.NewToolResultError(err.Error()), nil
}
```

### 3. Search and Filter Parameters

**Common Search Pattern**:
```go
mcp.WithString("search_term",
    mcp.Description("Optional search term to filter results"),
)
mcp.WithString("filter_type",
    mcp.Description("Type of filter to apply"),
    mcp.Enum([]string{"active", "inactive", "all"}),
)
```

**Common Sort Pattern**:
```go
mcp.WithString("sort",
    mcp.Description("Field to sort by"),
    mcp.Enum([]string{"name", "createdAt", "updatedAt"}),
)
mcp.WithString("order",
    mcp.Description("Sort order"),
    mcp.Enum([]string{"asc", "desc"}),
    mcp.DefaultString("asc"),
)
```

## Parameter Validation Helpers

### 1. Required Parameter Validation

```go
func RequiredParam[T comparable](r mcp.CallToolRequest, p string) (T, error) {
    var zero T
    
    // Check if parameter exists
    if _, ok := r.GetArguments()[p]; !ok {
        return zero, fmt.Errorf("missing required parameter: %s", p)
    }
    
    // Check type
    if _, ok := r.GetArguments()[p].(T); !ok {
        return zero, fmt.Errorf("parameter %s is not of type %T", p, zero)
    }
    
    // Check for zero value
    if r.GetArguments()[p].(T) == zero {
        return zero, fmt.Errorf("missing required parameter: %s", p)
    }
    
    return r.GetArguments()[p].(T), nil
}
```

### 2. Optional Parameter Validation

```go
func OptionalParam[T any](r mcp.CallToolRequest, p string) (T, error) {
    var zero T
    
    // Return zero value if not present
    if _, ok := r.GetArguments()[p]; !ok {
        return zero, nil
    }
    
    // Check type if present
    if _, ok := r.GetArguments()[p].(T); !ok {
        return zero, fmt.Errorf("parameter %s is not of type %T, is %T", 
            p, zero, r.GetArguments()[p])
    }
    
    return r.GetArguments()[p].(T), nil
}
```

### 3. Optional Parameter with Presence Check

```go
func OptionalParamOK[T any](r mcp.CallToolRequest, p string) (value T, ok bool, err error) {
    val, exists := r.GetArguments()[p]
    if !exists {
        return // zero value, false, nil
    }
    
    value, ok = val.(T)
    if !ok {
        err = fmt.Errorf("parameter %s is not of type %T, is %T", p, value, val)
        ok = true // Parameter was present, just wrong type
        return
    }
    
    ok = true
    return
}
```

## Tool Schema Examples

### 1. Simple Tool with Required Parameters

```go
func GetPipelineTool(config *config.Config, client *client.PipelineService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
    return mcp.NewTool("get_pipeline",
        mcp.WithDescription("Get details of a specific pipeline"),
        mcp.WithString("pipeline_id",
            mcp.Required(),
            mcp.Description("The ID of the pipeline"),
        ),
        common.WithScope(config, true),
    ),
    // Handler implementation...
}
```

**Generated JSON Schema**:
```json
{
  "type": "object",
  "properties": {
    "pipeline_id": {
      "type": "string",
      "description": "The ID of the pipeline"
    },
    "org_id": {
      "type": "string",
      "description": "Required ID of the organization"
    },
    "project_id": {
      "type": "string", 
      "description": "Required ID of the project"
    }
  },
  "required": ["pipeline_id", "org_id", "project_id"]
}
```

### 2. List Tool with Pagination and Filtering

```go
func ListPipelinesTool(config *config.Config, client *client.PipelineService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
    return mcp.NewTool("list_pipelines",
        mcp.WithDescription("List pipelines with filtering and pagination"),
        mcp.WithString("search_term",
            mcp.Description("Optional search term to filter pipelines"),
        ),
        mcp.WithString("status",
            mcp.Description("Pipeline status filter"),
            mcp.Enum([]string{"SUCCESS", "FAILED", "RUNNING"}),
        ),
        common.WithScope(config, true),
        WithPagination(),
    ),
    // Handler implementation...
}
```

**Generated JSON Schema**:
```json
{
  "type": "object",
  "properties": {
    "search_term": {
      "type": "string",
      "description": "Optional search term to filter pipelines"
    },
    "status": {
      "type": "string",
      "description": "Pipeline status filter",
      "enum": ["SUCCESS", "FAILED", "RUNNING"]
    },
    "org_id": {
      "type": "string",
      "description": "Required ID of the organization"
    },
    "project_id": {
      "type": "string",
      "description": "Required ID of the project"
    },
    "page": {
      "type": "number",
      "description": "Page number for pagination - page 0 is the first page",
      "default": 0,
      "minimum": 0
    },
    "size": {
      "type": "number",
      "description": "Number of items per page",
      "default": 5,
      "maximum": 20
    }
  },
  "required": ["org_id", "project_id"]
}
```

### 3. Complex Tool with Object Parameters

```go
func CreateDelegateTokenTool(config *config.Config, client *client.DelegateTokenClient) (tool mcp.Tool, handler server.ToolHandlerFunc) {
    return mcp.NewTool("create_delegate_token",
        mcp.WithDescription("Create a new delegate token"),
        mcp.WithString("name",
            mcp.Required(),
            mcp.Description("Token name"),
        ),
        mcp.WithObject("token_config",
            mcp.Description("Token configuration object"),
            mcp.Properties(map[string]interface{}{
                "revokeAfter": map[string]interface{}{
                    "type": "number",
                    "description": "Hours after which token expires",
                    "minimum": 1,
                    "maximum": 8760,
                },
                "tags": map[string]interface{}{
                    "type": "array",
                    "items": map[string]interface{}{
                        "type": "string",
                    },
                    "description": "List of tags for the token",
                },
            }),
        ),
        common.WithScope(config, false),
    ),
    // Handler implementation...
}
```

## Error Handling Patterns

### 1. Parameter Validation Errors

```go
// Return validation errors as tool errors (not exceptions)
pipelineID, err := RequiredParam[string](request, "pipeline_id")
if err != nil {
    return mcp.NewToolResultError(err.Error()), nil
}
```

### 2. Business Logic Errors

```go
// Return business logic errors as exceptions
data, err := client.Get(ctx, scope, pipelineID)
if err != nil {
    return nil, fmt.Errorf("failed to get pipeline: %w", err)
}
```

### 3. Scope Validation Errors

```go
scope, err := common.FetchScope(config, request, true)
if err != nil {
    return mcp.NewToolResultError(err.Error()), nil
}
```

## Response Formatting

### 1. Success Response

```go
// Marshal data to JSON string
r, err := json.Marshal(data)
if err != nil {
    return nil, fmt.Errorf("failed to marshal response: %w", err)
}

return mcp.NewToolResultText(string(r)), nil
```

### 2. Error Response

```go
// For validation errors
return mcp.NewToolResultError("Invalid parameter: pipeline_id is required"), nil

// For business logic errors (thrown as exceptions)
return nil, fmt.Errorf("failed to process request: %w", err)
```

## Schema Validation Best Practices

### 1. Parameter Naming Conventions

- Use snake_case for parameter names
- Use descriptive names (e.g., `pipeline_id` not `id`)
- Use consistent naming across tools (e.g., `search_term`, not `search` or `query`)

### 2. Type Safety

- Always validate parameter types using helper functions
- Use appropriate Go types (string, float64, bool, map[string]any)
- Handle type conversion explicitly (e.g., float64 to int)

### 3. Default Values

- Provide sensible defaults for optional parameters
- Use mcp.DefaultString(), mcp.DefaultNumber(), mcp.DefaultBoolean()
- Document default behavior in descriptions

### 4. Constraints

- Use mcp.Min(), mcp.Max() for numeric constraints
- Use mcp.Enum() for string value restrictions
- Use mcp.Required() for mandatory parameters

### 5. Documentation

- Provide clear, concise descriptions for all parameters
- Include examples in descriptions when helpful
- Document parameter relationships and dependencies

This comprehensive schema system ensures consistent, type-safe parameter handling across all Harness MCP tools while providing clear documentation for API consumers.