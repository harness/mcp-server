# Core Server Architecture and MCP Integration Analysis

## Overview
The Harness MCP Server is built around the Model Context Protocol (MCP) framework, providing a structured way to expose Harness platform capabilities to AI assistants and other tools through a standardized interface.

## Architecture Components

### 1. MCP Server Foundation
- **Framework**: Uses `github.com/mark3labs/mcp-go` for MCP protocol implementation
- **Communication**: JSON-RPC over stdin/stdout
- **Capabilities**: Tools, Resources, Prompts, and Logging
- **Recovery**: Built-in panic recovery to prevent crashes

```go
// Server creation with capabilities
s := server.NewMCPServer(
    "harness-mcp-server",
    version,
    server.WithToolCapabilities(true),
    server.WithResourceCapabilities(true, true),
    server.WithPromptCapabilities(true),
    server.WithLogging(),
    server.WithHooks(hooks),
    server.WithRecovery(),
)
```

### 2. Toolset Architecture

#### Toolset Structure
- **Toolset**: Group of related tools (e.g., pipelines, repositories, dashboards)
- **Read/Write Separation**: Tools categorized as read-only or write operations
- **Dynamic Enabling**: Toolsets can be enabled/disabled based on configuration
- **Read-Only Mode**: Global flag to restrict to read-only operations

#### Toolset Components
```go
type Toolset struct {
    Name        string              // Toolset identifier
    Description string              // Human-readable description
    Enabled     bool                // Whether toolset is active
    readOnly    bool                // Read-only mode flag
    writeTools  []server.ServerTool // Write operations
    readTools   []server.ServerTool // Read operations
}
```

#### Tool Registration Flow
1. **Create Toolset**: Define name, description, and tools
2. **Add to Group**: Register with ToolsetGroup
3. **Enable Toolsets**: Activate based on configuration
4. **Register with Server**: Add tools to MCP server

### 3. Module System (Licensing)

#### Module Interface
```go
type Module interface {
    ID() string                                    // Module identifier
    Name() string                                  // Display name
    Toolsets() []string                           // Provided toolsets
    RegisterToolsets() error                      // Create and register toolsets
    EnableToolsets(tsg *ToolsetGroup) error       // Activate toolsets
    IsDefault() bool                              // Default module flag
}
```

#### License Validation
- **License Client**: Validates account licenses via NG Manager API
- **Module Filtering**: Only licensed modules are enabled
- **Default Modules**: Always enabled regardless of license
- **License Status**: Checks for ACTIVE status

#### License Flow
1. **Create License Client** → NG Manager API
2. **Fetch Account Licenses** → Get all module licenses
3. **Validate Status** → Check ACTIVE status
4. **Filter Modules** → Enable only licensed modules
5. **Enable Default** → Always enable default modules

### 4. Prompt System

#### Prompt Structure
- **Name**: Unique identifier for the prompt
- **Description**: Purpose and usage
- **Text**: Template or instruction content
- **Result Description**: Expected output format

#### Built-in Prompts
1. **CCM Overview**: Date format validation for cost management
2. **Confirmation Policy**: User confirmation for destructive operations
3. **Pipeline Summarizer**: Comprehensive pipeline analysis

#### Prompt Registration
```go
func RegisterPrompts(mcpServer *server.MCPServer) {
    prompts := p.Prompts{}
    prompts.Append(p.NewPrompt().SetName("name").SetText("content").Build())
    p.AddPrompts(prompts, mcpServer)
}
```

### 5. Configuration Management

#### Configuration Structure
- **Common Fields**: Version, read-only, toolsets, logging
- **External Mode**: API key, base URL, org/project IDs
- **Internal Mode**: Bearer token, service URLs and secrets
- **Environment Variables**: HARNESS_ prefix for all settings

#### Configuration Loading
1. **CLI Flags** → Cobra command parsing
2. **Environment Variables** → Viper automatic loading
3. **Validation** → Required fields check
4. **Account Extraction** → API key parsing

### 6. Authentication & Authorization

#### External Mode (API Key)
- **Format**: `pat.ACCOUNT_ID.TOKEN_ID.<signature>`
- **Extraction**: Account ID from API key structure
- **Usage**: Direct Harness API calls

#### Internal Mode (Service Auth)
- **Bearer Token**: JWT for user authentication
- **Service Secrets**: Individual service authentication
- **Session Context**: Authenticated session in request context

### 7. HTTP Client Architecture

#### Client Creation
- **Base Client**: HTTP client with timeout and retry logic
- **Service-Specific**: Different clients for each Harness service
- **Authentication**: Automatic header injection
- **Error Handling**: Structured error responses

#### Retry Logic
- **Exponential Backoff**: Using `cenkalti/backoff` library
- **Retryable HTTP**: `hashicorp/go-retryablehttp` for resilience
- **Timeout Management**: Per-service timeout configuration

### 8. Error Handling Patterns

#### Error Types
- **Configuration Errors**: Missing required fields
- **Authentication Errors**: Invalid credentials
- **API Errors**: Harness service failures
- **Tool Errors**: Individual tool execution failures

#### Error Propagation
```go
// Standard Go error handling
result, err := someOperation()
if err != nil {
    return fmt.Errorf("operation failed: %w", err)
}
```

### 9. Concurrency Model

#### Goroutines Usage
- **Server Listener**: Main server runs in separate goroutine
- **Signal Handling**: Context-based cancellation
- **Error Communication**: Channel-based error reporting

#### Context Management
```go
ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
defer stop()
```

## Rust Migration Architecture

### 1. MCP Protocol Implementation
**Challenge**: No existing Rust MCP library
**Solution**: 
- Implement MCP protocol from scratch using `serde` for JSON-RPC
- Create async message handling with `tokio`
- Build tool/prompt/resource abstractions

### 2. Toolset System Migration
```rust
// Proposed Rust structure
#[derive(Debug, Clone)]
pub struct Toolset {
    pub name: String,
    pub description: String,
    pub enabled: bool,
    pub read_only: bool,
    pub read_tools: Vec<Tool>,
    pub write_tools: Vec<Tool>,
}

impl Toolset {
    pub async fn register_tools(&self, server: &mut McpServer) -> Result<(), Error> {
        for tool in &self.read_tools {
            server.add_tool(tool.clone()).await?;
        }
        if !self.read_only {
            for tool in &self.write_tools {
                server.add_tool(tool.clone()).await?;
            }
        }
        Ok(())
    }
}
```

### 3. Module System with Traits
```rust
#[async_trait]
pub trait Module: Send + Sync {
    fn id(&self) -> &str;
    fn name(&self) -> &str;
    fn toolsets(&self) -> Vec<String>;
    fn is_default(&self) -> bool;
    
    async fn register_toolsets(&self) -> Result<(), Error>;
    async fn enable_toolsets(&self, group: &mut ToolsetGroup) -> Result<(), Error>;
}
```

### 4. Configuration with Serde
```rust
#[derive(Debug, Deserialize, Serialize)]
pub struct Config {
    pub version: String,
    pub read_only: bool,
    pub toolsets: Vec<String>,
    pub enable_modules: Vec<String>,
    pub log_file_path: Option<String>,
    pub debug: bool,
    
    // External mode
    pub base_url: Option<String>,
    pub account_id: Option<String>,
    pub api_key: Option<String>,
    
    // Internal mode
    pub bearer_token: Option<String>,
    pub service_configs: HashMap<String, ServiceConfig>,
}
```

### 5. Async HTTP Client
```rust
use reqwest::{Client, ClientBuilder};
use reqwest_retry::{RetryTransientMiddleware, policies::ExponentialBackoff};

pub struct HarnessClient {
    client: Client,
    base_url: String,
    auth_header: String,
}

impl HarnessClient {
    pub async fn new(config: &Config) -> Result<Self, Error> {
        let retry_policy = ExponentialBackoff::builder().build_with_max_retries(3);
        let client = ClientBuilder::new()
            .timeout(Duration::from_secs(30))
            .build()?;
            
        Ok(Self {
            client,
            base_url: config.base_url.clone(),
            auth_header: format!("Bearer {}", config.api_key),
        })
    }
}
```

### 6. Error Handling with thiserror
```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum HarnessError {
    #[error("Configuration error: {0}")]
    Config(String),
    
    #[error("Authentication failed: {0}")]
    Auth(String),
    
    #[error("API request failed: {status} - {message}")]
    Api { status: u16, message: String },
    
    #[error("Tool execution failed: {0}")]
    Tool(String),
}
```

### 7. Async Runtime with Tokio
```rust
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::fmt::init();
    
    // Parse CLI
    let cli = Cli::parse();
    
    // Load configuration
    let config = load_config(&cli).await?;
    
    // Create server
    let mut server = McpServer::new(&config).await?;
    
    // Initialize toolsets
    let toolsets = initialize_toolsets(&config).await?;
    toolsets.register_tools(&mut server).await?;
    
    // Start server
    let shutdown = tokio::signal::ctrl_c();
    server.run_until_shutdown(shutdown).await?;
    
    Ok(())
}
```

## Key Migration Challenges

### 1. MCP Protocol Implementation
- **Go**: Uses existing `mark3labs/mcp-go` library
- **Rust**: Need to implement JSON-RPC MCP protocol from scratch
- **Solution**: Create async MCP server using `serde_json` and `tokio`

### 2. Dynamic Tool Registration
- **Go**: Runtime tool registration with interface{}
- **Rust**: Compile-time type safety with trait objects
- **Solution**: Use `Box<dyn Tool>` for dynamic dispatch

### 3. HTTP Client Ecosystem
- **Go**: `net/http` with retry middleware
- **Rust**: `reqwest` with `reqwest-retry` middleware
- **Solution**: Similar patterns, better async support

### 4. Configuration Management
- **Go**: Viper for complex config loading
- **Rust**: `config` + `serde` for structured configuration
- **Solution**: More type-safe configuration handling

### 5. Error Handling
- **Go**: Error returns with wrapping
- **Rust**: Result types with `?` operator
- **Solution**: More ergonomic error handling

## Benefits of Rust Migration

1. **Memory Safety**: No null pointer dereferences or buffer overflows
2. **Performance**: Zero-cost abstractions and efficient async runtime
3. **Type Safety**: Compile-time error checking
4. **Concurrency**: Fearless concurrency with ownership system
5. **Ecosystem**: Rich crate ecosystem for HTTP, JSON, async
6. **Maintainability**: Better code organization with modules and traits