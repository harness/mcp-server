# Harness MCP Tools Catalog Analysis

## Overview
The Harness MCP Server implements 37 tool files containing hundreds of individual tools across all major Harness platform capabilities. This represents a massive scope for the Rust migration.

## Tool Categories by File Size and Complexity

### 1. Large/Complex Tool Files (>10KB)

#### Supply Chain Security (SCS) - 49,161 bytes
- **File**: `scs.go`
- **Scope**: Comprehensive supply chain security tools
- **Complexity**: Highest - artifact scanning, SBOM, compliance, vulnerabilities
- **Key Tools**: artifact sources, artifacts per source, artifact overview, chain of custody, compliance results, code repository overview

#### Cloud Cost Management (CCM) - 99,285 bytes total
- **Files**: 
  - `ccmperspectives.go` (33,043 bytes)
  - `ccmgraphqlperspectives.go` (23,285 bytes) 
  - `ccmcosts.go` (22,541 bytes)
  - `ccmrecommendations.go` (18,435 bytes)
  - `ccmcommitments.go` (11,624 bytes)
- **Scope**: Complete cost management and optimization
- **Key Tools**: cost perspectives, recommendations, commitments, GraphQL queries, budget management

#### Security Testing Orchestration (STO) - 28,777 bytes
- **File**: `sto.go`
- **Scope**: Security testing and vulnerability management
- **Key Tools**: security issues list, global exemptions, exemption promotion/approval

#### Core Platform Tools (>10KB each)
- **Pipelines** (14,226 bytes): Pipeline CRUD, executions, summaries
- **Pull Requests** (14,367 bytes): PR management, checks, activities, creation
- **Internal Developer Portal** (14,398 bytes): Entity management, scorecards, scores
- **Access Control** (13,577 bytes): RBAC, permissions, user management
- **GenAI** (12,338 bytes): AI-powered tools and intelligent search
- **Connectors** (12,001 bytes): Connector catalog, management, details
- **Intelligence** (10,586 bytes): Analytics and insights
- **Audit** (10,019 bytes): Audit trail and user activity tracking

### 2. Medium Complexity Tool Files (5-10KB)

#### Infrastructure & Environment Management
- **Environments** (9,919 bytes): Environment CRUD, config management
- **Infrastructure** (9,552 bytes): Infrastructure definitions, config movement
- **ACM** (8,000 bytes): Application Configuration Management

#### Platform Services
- **Dashboards** (7,835 bytes): Dashboard listing, data retrieval
- **Prompt Tools** (7,110 bytes): AI prompt management and templates
- **Secrets** (5,949 bytes): Secret management and retrieval
- **Versions** (5,864 bytes): Version management across services
- **Parameters** (5,546 bytes): Parameter handling utilities

### 3. Specialized Tool Files (2-5KB)

#### Development & Testing
- **Chaos Engineering** (4,882 bytes): Chaos experiments, execution, results
- **Templates** (4,658 bytes): Template management and intelligent search
- **Logs** (3,971 bytes): Execution log download and management
- **Services** (3,902 bytes): Service management and configuration
- **Repositories** (3,851 bytes): Repository management and details

#### Platform Utilities
- **Filter** (4,638 bytes): Advanced filtering capabilities
- **Registries** (4,066 bytes): Artifact registry management
- **Settings** (2,781 bytes): Platform settings and notifications
- **Scope** (2,587 bytes): Scope resolution utilities
- **Chatbot** (2,521 bytes): AI chatbot integration
- **Database Operations** (2,520 bytes): Database schema operations
- **Artifacts** (2,362 bytes): Artifact management utilities

### 4. Utility Files (<1KB)
- **Pagination** (964 bytes): Pagination helper utilities

## Tool Pattern Analysis

### Common Tool Structure
```go
func ToolNameTool(config *config.Config, client *client.ServiceClient) (mcp.Tool, server.ToolHandlerFunc) {
    return mcp.NewTool("tool_name",
        mcp.WithDescription("Tool description"),
        mcp.WithString("param1", mcp.Required(), mcp.Description("Parameter description")),
        WithScope(config, requiresProject),
    ),
    func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
        // Parameter extraction
        param1, err := RequiredParam[string](request, "param1")
        if err != nil {
            return mcp.NewToolResultError(err.Error()), nil
        }
        
        // Scope resolution
        scope, err := FetchScope(config, request, requiresProject)
        if err != nil {
            return mcp.NewToolResultError(err.Error()), nil
        }
        
        // API call
        data, err := client.SomeOperation(ctx, scope, param1)
        if err != nil {
            return nil, fmt.Errorf("operation failed: %w", err)
        }
        
        // Response marshaling
        result, err := json.Marshal(data)
        if err != nil {
            return nil, fmt.Errorf("failed to marshal response: %w", err)
        }
        
        return mcp.NewToolResultText(string(result)), nil
    }
}
```

### Parameter Types
- **String Parameters**: IDs, names, descriptions, URLs
- **Boolean Parameters**: Flags for optional behavior
- **Integer Parameters**: Limits, offsets, counts
- **Array Parameters**: Lists of IDs, filters, tags
- **Enum Parameters**: Status values, types, categories
- **Complex Objects**: Filters, configurations, metadata

### Scope Requirements
- **Account Level**: Basic operations, catalogs
- **Organization Level**: Org-specific resources
- **Project Level**: Project-specific resources like pipelines, services

### Error Handling Patterns
- **Parameter Validation**: Required parameter checking
- **Scope Validation**: Org/project requirement validation
- **API Error Propagation**: Harness API error handling
- **JSON Marshaling**: Response serialization errors

## Rust Migration Challenges by Category

### 1. High Complexity Migrations

#### SCS Tools (Supply Chain Security)
- **Challenge**: Complex data structures, SBOM parsing, compliance rules
- **Rust Benefits**: Memory safety for parsing, strong typing for compliance data
- **Estimated Effort**: 3-4 weeks

#### CCM Tools (Cloud Cost Management)
- **Challenge**: GraphQL integration, complex financial calculations, time series data
- **Rust Benefits**: Precise decimal arithmetic, async GraphQL clients
- **Estimated Effort**: 4-5 weeks

#### STO Tools (Security Testing)
- **Challenge**: Vulnerability data processing, exemption workflows
- **Rust Benefits**: Safe data processing, strong typing for security data
- **Estimated Effort**: 2-3 weeks

### 2. Medium Complexity Migrations

#### Core Platform Tools (Pipelines, PRs, IDP, etc.)
- **Challenge**: Complex API integrations, state management
- **Rust Benefits**: Better async handling, type safety
- **Estimated Effort**: 1-2 weeks each

#### Infrastructure Tools
- **Challenge**: YAML processing, configuration management
- **Rust Benefits**: Better YAML libraries, configuration validation
- **Estimated Effort**: 1-2 weeks each

### 3. Low Complexity Migrations

#### Utility Tools
- **Challenge**: Simple CRUD operations, basic data transformation
- **Rust Benefits**: Faster execution, better error handling
- **Estimated Effort**: 2-3 days each

## Proposed Rust Tool Architecture

### 1. Tool Trait Definition
```rust
#[async_trait]
pub trait Tool: Send + Sync {
    fn name(&self) -> &str;
    fn description(&self) -> &str;
    fn parameters(&self) -> Vec<Parameter>;
    fn requires_scope(&self) -> ScopeRequirement;
    
    async fn execute(
        &self,
        ctx: &Context,
        params: &ToolParameters,
        scope: &Scope,
    ) -> Result<ToolResult, ToolError>;
}
```

### 2. Parameter System
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Parameter {
    String {
        name: String,
        description: String,
        required: bool,
        default: Option<String>,
    },
    Integer {
        name: String,
        description: String,
        required: bool,
        min: Option<i64>,
        max: Option<i64>,
        default: Option<i64>,
    },
    Boolean {
        name: String,
        description: String,
        required: bool,
        default: Option<bool>,
    },
    Array {
        name: String,
        description: String,
        required: bool,
        item_type: Box<Parameter>,
    },
}
```

### 3. Scope Management
```rust
#[derive(Debug, Clone)]
pub enum ScopeRequirement {
    Account,
    Organization,
    Project,
}

#[derive(Debug, Clone)]
pub struct Scope {
    pub account_id: String,
    pub org_id: Option<String>,
    pub project_id: Option<String>,
}
```

### 4. Error Handling
```rust
#[derive(Error, Debug)]
pub enum ToolError {
    #[error("Missing required parameter: {0}")]
    MissingParameter(String),
    
    #[error("Invalid parameter value: {0}")]
    InvalidParameter(String),
    
    #[error("Scope validation failed: {0}")]
    ScopeError(String),
    
    #[error("API call failed: {0}")]
    ApiError(String),
    
    #[error("Serialization failed: {0}")]
    SerializationError(String),
}
```

### 5. HTTP Client Integration
```rust
#[async_trait]
pub trait HarnessClient: Send + Sync {
    async fn get<T>(&self, path: &str, scope: &Scope) -> Result<T, ClientError>
    where
        T: DeserializeOwned;
        
    async fn post<T, U>(&self, path: &str, scope: &Scope, body: &T) -> Result<U, ClientError>
    where
        T: Serialize,
        U: DeserializeOwned;
        
    async fn put<T, U>(&self, path: &str, scope: &Scope, body: &T) -> Result<U, ClientError>
    where
        T: Serialize,
        U: DeserializeOwned;
        
    async fn delete(&self, path: &str, scope: &Scope) -> Result<(), ClientError>;
}
```

## Migration Strategy

### Phase 1: Core Infrastructure (2-3 weeks)
1. **Tool Framework**: Implement base tool trait and parameter system
2. **Scope Management**: Implement scope resolution and validation
3. **HTTP Client**: Create async Harness API client with retry logic
4. **Error Handling**: Implement comprehensive error types

### Phase 2: Utility Tools (1-2 weeks)
1. **Pagination**: Migrate pagination utilities
2. **Scope**: Migrate scope resolution tools
3. **Parameters**: Migrate parameter handling utilities
4. **Filter**: Migrate filtering capabilities

### Phase 3: Core Platform Tools (6-8 weeks)
1. **Pipelines**: Migrate all pipeline-related tools
2. **Connectors**: Migrate connector management tools
3. **Services**: Migrate service management tools
4. **Environments**: Migrate environment tools
5. **Infrastructure**: Migrate infrastructure tools
6. **Pull Requests**: Migrate PR management tools
7. **Repositories**: Migrate repository tools

### Phase 4: Advanced Platform Tools (4-6 weeks)
1. **Dashboards**: Migrate dashboard tools
2. **Secrets**: Migrate secret management tools
3. **Settings**: Migrate platform settings tools
4. **Templates**: Migrate template tools
5. **Versions**: Migrate version management tools
6. **Audit**: Migrate audit trail tools

### Phase 5: Specialized Tools (6-8 weeks)
1. **CCM Suite**: Migrate all cost management tools
2. **SCS Tools**: Migrate supply chain security tools
3. **STO Tools**: Migrate security testing tools
4. **IDP Tools**: Migrate internal developer portal tools
5. **Chaos Tools**: Migrate chaos engineering tools
6. **GenAI Tools**: Migrate AI-powered tools

### Phase 6: Integration & Testing (2-3 weeks)
1. **Tool Registration**: Implement dynamic tool registration
2. **Integration Testing**: Test all tools with real Harness APIs
3. **Performance Testing**: Ensure Rust version meets performance requirements
4. **Documentation**: Update all tool documentation

## Total Estimated Effort
- **Development**: 20-30 weeks (5-7 months)
- **Testing**: 4-6 weeks
- **Documentation**: 2-3 weeks
- **Total**: 26-39 weeks (6-9 months)

This represents a significant migration effort, but the benefits of Rust's safety, performance, and maintainability make it worthwhile for a project of this scale and complexity.