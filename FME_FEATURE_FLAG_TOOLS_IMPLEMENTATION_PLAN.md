# FME Feature Flag Tools Implementation Plan

## Overview
Add 4 new MCP tools to the Harness MCP server for interacting with FME (Feature Management Engine) feature flags. These tools will allow users to discover workspaces, environments, and feature flags, then get detailed rollout status information to help determine which code branches will be executed.

## Background
- FME is Split.io feature flags now integrated into Harness
- Webadmin endpoints accept Harness Personal Access Tokens (PAT) and Service Account Tokens (SAT)
- Base URL: `https://api.split.io`
- Authentication follows existing MCP server patterns using `x-api-key` header or `Authorization: Bearer` header

## Tool Suite Design

### Tool 1: `list_fme_workspaces`
**Purpose**: List available FME workspaces for users to save workspace IDs to CLAUDE.md

**API Endpoint**: `GET https://api.split.io/internal/api/v2/workspaces`

**Parameters**:
- `name` (optional, string): Filter workspaces by name

**Implementation**:
- Uses same authentication as existing Harness tools
- Client-side filtering by name if parameter provided
- Returns complete workspace objects for user reference

**Output**: JSON array of workspace objects
```json
[
  {
    "id": "workspace-id-123",
    "name": "Production Workspace",
    "description": "Main production environment workspace"
  }
]
```

---

### Tool 2: `list_fme_environments`
**Purpose**: List environments in a workspace for users to save environment IDs to CLAUDE.md

**API Endpoint**: `GET https://api.split.io/internal/api/v2/environments/ws/{wsId}`

**Parameters**:
- `workspace_id` (required, string): Workspace ID to list environments for
- `name` (optional, string): Filter environments by name

**Implementation**:
- Replace `{wsId}` in URL path with workspace_id parameter
- Client-side filtering by name if parameter provided
- Error handling for invalid workspace IDs

**Output**: JSON array of environment objects
```json
[
  {
    "id": "env-id-456",
    "name": "production",
    "type": "production"
  }
]
```

---

### Tool 3: `list_fme_feature_flags`
**Purpose**: Browse available feature flags in a workspace with optional filtering

**API Endpoint**: `GET https://api.split.io/internal/api/v2/splits/ws/{wsId}`

**Parameters**:
- `workspace_id` (required, string): Workspace ID
- `name` (optional, string): Filter flags by name using API's `name` query parameter
- `limit` (optional, number, default 20): Number of results to return using API's `limit` query parameter

**Implementation**:
- Replace `{wsId}` in URL path with workspace_id parameter
- Pass `name` and `limit` as query parameters to API
- Handle pagination if needed (offset parameter available in API)

**Output**: JSON array of feature flag objects
```json
[
  {
    "name": "new_checkout_flow",
    "description": "Enable new checkout experience",
    "rolloutStatus": "ACTIVE",
    "id": "flag-id-789"
  }
]
```

---

### Tool 4: `get_fme_feature_flag_rollout_status`
**Purpose**: Get detailed rollout configuration for a specific feature flag in an environment

**API Endpoint**: `GET https://api.split.io/internal/api/v2/splits/ws/{wsId}/{splitName}/environments/{envId}`

**Parameters**:
- `workspace_id` (required, string): Workspace ID
- `environment_id` (required, string): Environment ID
- `flag_name` (required, string): Feature flag name

**Implementation**:
- Replace `{wsId}`, `{splitName}`, and `{envId}` in URL path
- Return complete rollout configuration for agent decision-making
- Include treatments, targeting rules, traffic allocation

**Output**: JSON object with complete rollout details
```json
{
  "name": "new_checkout_flow",
  "environment": "production",
  "rolloutStatus": "ACTIVE",
  "treatments": [
    {
      "name": "on",
      "configuration": {},
      "percentage": 50
    },
    {
      "name": "off", 
      "configuration": {},
      "percentage": 50
    }
  ],
  "targetingRules": [],
  "defaultTreatment": "off"
}
```

## Implementation Structure

### 1. Configuration Changes
**File**: `/cmd/harness-mcp-server/config/config.go`

Add FME configuration:
```go
type Config struct {
    // ... existing fields
    FME FMEConfig `yaml:"fme"`
}

type FMEConfig struct {
    BaseURL string `yaml:"base_url"`
}
```

**Default Configuration**:
```yaml
fme:
  base_url: "https://api.split.io"
```

### 2. HTTP Client Layer
**File**: `/client/fme.go`

```go
package client

import (
    "context"
    "encoding/json"
    "fmt"
    "net/http"
    "net/url"
    
    "github.com/harness/harness-mcp/client/dto"
)

type FMEService struct {
    client  *http.Client
    baseURL string
}

func NewFMEService(baseURL string, client *http.Client) *FMEService {
    return &FMEService{
        client:  client,
        baseURL: baseURL,
    }
}

func (s *FMEService) ListWorkspaces(ctx context.Context, nameFilter *string) ([]dto.FMEWorkspace, error) {
    // Implementation
}

func (s *FMEService) ListEnvironments(ctx context.Context, workspaceID string, nameFilter *string) ([]dto.FMEEnvironment, error) {
    // Implementation
}

func (s *FMEService) ListFeatureFlags(ctx context.Context, workspaceID string, nameFilter *string, limit *int) ([]dto.FMEFeatureFlag, error) {
    // Implementation
}

func (s *FMEService) GetFeatureFlagRolloutStatus(ctx context.Context, workspaceID, environmentID, flagName string) (*dto.FMEFeatureFlagRollout, error) {
    // Implementation
}
```

### 3. Data Transfer Objects
**File**: `/client/dto/fme.go`

```go
package dto

type FMEWorkspace struct {
    ID          string `json:"id"`
    Name        string `json:"name"`
    Description string `json:"description"`
}

type FMEEnvironment struct {
    ID   string `json:"id"`
    Name string `json:"name"`
    Type string `json:"type"`
}

type FMEFeatureFlag struct {
    ID            string `json:"id"`
    Name          string `json:"name"`
    Description   string `json:"description"`
    RolloutStatus string `json:"rolloutStatus"`
}

type FMEFeatureFlagRollout struct {
    Name              string                   `json:"name"`
    Environment       string                   `json:"environment"`
    RolloutStatus     string                   `json:"rolloutStatus"`
    Treatments        []FMETreatment          `json:"treatments"`
    TargetingRules    []FMETargetingRule      `json:"targetingRules"`
    DefaultTreatment  string                   `json:"defaultTreatment"`
    LastUpdated       string                   `json:"lastUpdated"`
}

type FMETreatment struct {
    Name          string                 `json:"name"`
    Configuration map[string]interface{} `json:"configuration"`
    Percentage    float64               `json:"percentage"`
}

type FMETargetingRule struct {
    Condition  string  `json:"condition"`
    Treatment  string  `json:"treatment"`
    Percentage float64 `json:"percentage"`
}
```

### 4. Tool Implementation
**File**: `/pkg/harness/tools/fme.go`

```go
package tools

import (
    "context"
    "encoding/json"
    "fmt"
    
    "github.com/harness/harness-mcp/client"
    "github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
    "github.com/mark3labs/mcp-go/mcp"
    "github.com/mark3labs/mcp-go/server"
)

// GetListFMEWorkspacesTool creates the list_fme_workspaces tool
func GetListFMEWorkspacesTool(config *config.Config, fmeClient *client.FMEService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
    return mcp.NewTool("list_fme_workspaces",
            mcp.WithDescription("List available FME workspaces"),
            mcp.WithString("name",
                mcp.Description("Optional filter to search workspaces by name"),
            ),
        ),
        func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
            // Implementation
        }
}

// GetListFMEEnvironmentsTool creates the list_fme_environments tool
func GetListFMEEnvironmentsTool(config *config.Config, fmeClient *client.FMEService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
    return mcp.NewTool("list_fme_environments",
            mcp.WithDescription("List environments in an FME workspace"),
            mcp.WithString("workspace_id",
                mcp.Description("Workspace ID to list environments for"),
                mcp.Required(),
            ),
            mcp.WithString("name",
                mcp.Description("Optional filter to search environments by name"),
            ),
        ),
        func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
            // Implementation
        }
}

// GetListFMEFeatureFlagsTool creates the list_fme_feature_flags tool
func GetListFMEFeatureFlagsTool(config *config.Config, fmeClient *client.FMEService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
    return mcp.NewTool("list_fme_feature_flags",
            mcp.WithDescription("List feature flags in an FME workspace"),
            mcp.WithString("workspace_id",
                mcp.Description("Workspace ID to list feature flags for"),
                mcp.Required(),
            ),
            mcp.WithString("name",
                mcp.Description("Optional filter to search feature flags by name"),
            ),
            mcp.WithNumber("limit",
                mcp.Description("Maximum number of feature flags to return (default: 20)"),
            ),
        ),
        func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
            // Implementation
        }
}

// GetFMEFeatureFlagRolloutStatusTool creates the get_fme_feature_flag_rollout_status tool
func GetFMEFeatureFlagRolloutStatusTool(config *config.Config, fmeClient *client.FMEService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
    return mcp.NewTool("get_fme_feature_flag_rollout_status",
            mcp.WithDescription("Get detailed rollout status for an FME feature flag to help determine which code branch will be executed"),
            mcp.WithString("workspace_id",
                mcp.Description("Workspace ID containing the feature flag"),
                mcp.Required(),
            ),
            mcp.WithString("environment_id",
                mcp.Description("Environment ID to get rollout status for"),
                mcp.Required(),
            ),
            mcp.WithString("flag_name",
                mcp.Description("Feature flag name to get rollout status for"),
                mcp.Required(),
            ),
        ),
        func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
            // Implementation
        }
}
```

### 5. Tool Registration
**File**: `/pkg/harness/tools.go`

Add to tool registration logic:
```go
// Add FME client initialization
fmeClient := client.NewFMEService(config.FME.BaseURL, httpClient)

// Register FME tools
fmeTools := []struct {
    tool    mcp.Tool
    handler server.ToolHandlerFunc
}{
    tools.GetListFMEWorkspacesTool(config, fmeClient),
    tools.GetListFMEEnvironmentsTool(config, fmeClient),
    tools.GetListFMEFeatureFlagsTool(config, fmeClient),
    tools.GetFMEFeatureFlagRolloutStatusTool(config, fmeClient),
}

for _, fmeTool := range fmeTools {
    if err := mcpServer.AddTool(fmeTool.tool, fmeTool.handler); err != nil {
        return fmt.Errorf("failed to add FME tool %s: %w", fmeTool.tool.Name, err)
    }
}
```

## Authentication
- Uses existing Harness authentication mechanism
- Supports both Personal Access Tokens (PAT) and Service Account Tokens (SAT)
- Token format: `pat.{20-24}.{20-24}.{20-24}` or `sat.{20-24}.{20-24}.{20-24}`
- Authentication via `x-api-key` header or `Authorization: Bearer` header
- Same `HarnessAccountTokenFilter` handles authentication

## Error Handling
- **Invalid workspace/environment IDs**: Return clear error messages
- **Network failures**: Standard HTTP error handling following existing patterns
- **Authentication failures**: Leverage existing auth error handling
- **No results found**: Return empty arrays, not errors
- **Invalid parameters**: Validate required parameters and return descriptive errors

## Testing Strategy
1. **Unit Tests**: Mock HTTP responses for each client method
2. **Integration Tests**: Test against staging environment with test credentials
3. **Tool Tests**: Test MCP tool parameter validation and response formatting
4. **Authentication Tests**: Verify PAT/SAT token handling

## User Workflow
1. Run `list_fme_workspaces` to discover available workspaces
2. Copy workspace ID to CLAUDE.md file for future reference
3. Run `list_fme_environments` with workspace ID to discover environments
4. Copy environment IDs to CLAUDE.md file for future reference
5. Use `list_fme_feature_flags` to browse available flags in workspace
6. Use `get_fme_feature_flag_rollout_status` with saved workspace/environment IDs for quick rollout status lookups

## Configuration Example
Users can save this to their CLAUDE.md:
```markdown
# FME Configuration
- **Production Workspace ID**: `workspace-abc-123`
- **Staging Workspace ID**: `workspace-def-456`
- **Environments**:
  - Production: `env-prod-789`
  - Staging: `env-stage-012`
```

## Implementation Checklist
- [ ] Add FME config structure to `/cmd/harness-mcp-server/config/config.go`
- [ ] Create `/client/fme.go` with HTTP client implementation
- [ ] Create `/client/dto/fme.go` with data structures
- [ ] Create `/pkg/harness/tools/fme.go` with all 4 tool implementations
- [ ] Update `/pkg/harness/tools.go` to register FME tools
- [ ] Add unit tests for client layer
- [ ] Add integration tests for tools
- [ ] Update configuration files with FME base URL
- [ ] Test with staging environment
- [ ] Document tools in README or help system

## Dependencies
- No new external Go dependencies required
- Uses existing HTTP client and authentication patterns
- Follows existing MCP tool structure and patterns
- Leverages existing error handling and logging infrastructure