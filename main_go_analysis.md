# Main.go Entry Point Analysis for Rust Migration

## Overview
The main.go file serves as the entry point for the Harness MCP Server, implementing a CLI application using the Cobra framework with two primary modes: `stdio` and `internal`.

## Command Structure

### Root Command
- **Name**: `harness-mcp-server`
- **Description**: "A Harness MCP server that handles various tools and resources"
- **Version**: Embedded at build time (version, commit, date)

### Subcommands

#### 1. `stdio` Command
- **Purpose**: Standard external mode for MCP communication
- **Communication**: JSON-RPC over stdin/stdout
- **Authentication**: API key based
- **Target Users**: External integrations, AI assistants

#### 2. `internal` Command (nested under stdio)
- **Purpose**: Internal Harness platform mode
- **Communication**: JSON-RPC over stdin/stdout (will move to HTTP)
- **Authentication**: Bearer token + service secrets
- **Target Users**: Internal Harness services

## Configuration Management

### Viper Integration
- **Environment Prefix**: `HARNESS_`
- **Auto Environment**: Enabled
- **Flag Binding**: All CLI flags bound to Viper keys

### Global Flags (Available to all commands)
```go
--toolsets         []string  // Tool groups to enable
--enable-modules   []string  // Modules to enable (license mode)
--enable-license   bool      // Enable license validation
--read-only        bool      // Restrict to read-only operations
--log-file         string    // Path to log file
--debug            bool      // Enable debug logging
```

### Stdio-Specific Flags
```go
--base-url           string  // Harness base URL (default: https://app.harness.io)
--api-key            string  // API key for authentication
--default-org-id     string  // Default organization ID
--default-project-id string  // Default project ID
```

### Internal-Specific Flags (20+ service configurations)
```go
--bearer-token                string  // Bearer token for auth
--pipeline-svc-base-url       string  // Pipeline service URL
--pipeline-svc-secret         string  // Pipeline service secret
--ng-manager-base-url         string  // NG Manager URL
--ng-manager-secret           string  // NG Manager secret
// ... and many more service configurations
```

## Key Functions

### 1. `extractAccountIDFromAPIKey()`
- **Purpose**: Extracts account ID from Harness API key
- **Format**: `pat.ACCOUNT_ID.TOKEN_ID.<>`
- **Error Handling**: Returns error for invalid format

### 2. `runStdioServer()`
- **Purpose**: Main server execution logic
- **Responsibilities**:
  - Initialize logging
  - Create MCP server with hooks
  - Initialize toolsets
  - Register tools and prompts
  - Start stdio communication
  - Handle graceful shutdown

### 3. `initLogger()`
- **Purpose**: Set up structured logging
- **Features**: File output, debug level control
- **Framework**: Uses `slog` (structured logging)

## Server Initialization Flow

1. **Parse CLI arguments** (Cobra)
2. **Load configuration** (Viper + environment)
3. **Extract account ID** from API key
4. **Create config struct** with all settings
5. **Initialize logger** if log file specified
6. **Create MCP server** with hooks and recovery
7. **Initialize toolsets** based on configuration
8. **Register tools** with the server
9. **Create module registry** for licensed features
10. **Register prompts** (generic + module-specific)
11. **Start stdio server** with error handling
12. **Wait for shutdown** signal or error

## Error Handling Patterns

### Configuration Errors
- Missing API key → Fatal error
- Invalid API key format → Fatal error
- Failed toolset unmarshaling → Fatal error

### Runtime Errors
- Logger initialization failure → Fatal error
- Toolset initialization failure → Logged but continues
- Server startup failure → Fatal error

## Concurrency and Signals

### Signal Handling
```go
ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
defer stop()
```

### Goroutine Management
- Main server runs in separate goroutine
- Error channel for communication
- Context-based cancellation

## Rust Migration Considerations

### 1. CLI Framework Migration
- **From**: Cobra (Go)
- **To**: Clap (Rust)
- **Changes**: 
  - Derive-based command definitions
  - Built-in help generation
  - Subcommand nesting

### 2. Configuration Management
- **From**: Viper (Go)
- **To**: `config` + `serde` + `clap` (Rust)
- **Changes**:
  - Struct-based configuration with derives
  - Environment variable integration
  - TOML/YAML support via serde

### 3. Logging
- **From**: `slog` (Go)
- **To**: `tracing` + `tracing-subscriber` (Rust)
- **Benefits**: Better async support, structured logging

### 4. Error Handling
- **From**: Error returns + panic
- **To**: `Result<T, E>` + `anyhow`/`thiserror`
- **Benefits**: Compile-time error checking

### 5. Async Runtime
- **From**: Goroutines + channels
- **To**: `tokio` + async/await
- **Changes**: Explicit async functions, structured concurrency

## Proposed Rust Structure

```rust
// main.rs
use clap::{Parser, Subcommand};
use tokio::signal;

#[derive(Parser)]
#[command(name = "harness-mcp-server")]
#[command(about = "A Harness MCP server that handles various tools and resources")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
    
    #[arg(long, value_delimiter = ',')]
    toolsets: Vec<String>,
    
    #[arg(long)]
    enable_license: bool,
    
    #[arg(long)]
    read_only: bool,
    
    #[arg(long)]
    log_file: Option<String>,
    
    #[arg(long)]
    debug: bool,
}

#[derive(Subcommand)]
enum Commands {
    Stdio {
        #[arg(long, default_value = "https://app.harness.io")]
        base_url: String,
        
        #[arg(long)]
        api_key: String,
        
        #[arg(long)]
        default_org_id: Option<String>,
        
        #[arg(long)]
        default_project_id: Option<String>,
        
        #[command(subcommand)]
        internal: Option<InternalCommands>,
    },
}

#[derive(Subcommand)]
enum InternalCommands {
    Internal {
        #[arg(long)]
        bearer_token: String,
        // ... other internal flags
    },
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();
    
    // Initialize tracing
    tracing_subscriber::fmt::init();
    
    // Handle shutdown signals
    let shutdown = signal::ctrl_c();
    
    match cli.command {
        Commands::Stdio { .. } => {
            run_stdio_server(cli, shutdown).await?;
        }
    }
    
    Ok(())
}
```

## Key Migration Tasks

1. **Port CLI structure** to Clap derive macros
2. **Implement configuration loading** with serde
3. **Set up tracing/logging** infrastructure
4. **Create async server runtime** with tokio
5. **Implement signal handling** for graceful shutdown
6. **Port authentication logic** (API key extraction)
7. **Create error types** with thiserror
8. **Implement server initialization** flow
9. **Add configuration validation**
10. **Set up module system** for licensed features