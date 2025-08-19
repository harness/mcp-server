// Traits for Harness MCP Server
// Converted from Go interfaces to Rust traits

use anyhow::Result;
use async_trait::async_trait;
use crate::harness::errors::HarnessResult;
use crate::harness::tools::{Tool, ToolCall, ToolResult};
use crate::harness::prompts::{Prompt, PromptMessage};

/// Module trait defines the contract that all modules must implement
/// Converted from Go's Module interface
#[async_trait]
pub trait Module: Send + Sync {
    /// Returns the identifier for this module
    fn id(&self) -> &str;
    
    /// Returns the name of module
    fn name(&self) -> &str;
    
    /// Returns the names of toolsets provided by this module
    fn toolsets(&self) -> Vec<String>;
    
    /// Registers all toolsets in this module with the toolset group
    /// It creates necessary clients and adds tools to the toolset group
    async fn register_toolsets(&self) -> Result<()>;
    
    /// Enables all toolsets in this module in the toolset group
    /// This is called after register_toolsets to activate the toolsets
    async fn enable_toolsets(&self, toolset_group: &mut dyn ToolsetGroup) -> Result<()>;
    
    /// Indicates if this module should be enabled by default
    /// when no specific modules are requested
    fn is_default(&self) -> bool;
}

/// ToolsetGroup trait for managing collections of toolsets
#[async_trait]
pub trait ToolsetGroup: Send + Sync {
    /// Adds a toolset to the group
    async fn add_toolset(&mut self, name: String, toolset: Box<dyn Toolset>) -> Result<()>;
    
    /// Enables specific toolsets by name
    async fn enable_toolsets(&mut self, toolset_names: Vec<String>) -> Result<()>;
    
    /// Gets a toolset by name
    fn get_toolset(&self, name: &str) -> Option<&dyn Toolset>;
    
    /// Lists all available toolset names
    fn list_toolsets(&self) -> Vec<String>;
}

/// Toolset trait for collections of related tools
#[async_trait]
pub trait Toolset: Send + Sync {
    /// Returns the name of this toolset
    fn name(&self) -> &str;
    
    /// Returns the description of this toolset
    fn description(&self) -> &str;
    
    /// Returns all tools in this toolset
    fn tools(&self) -> Vec<Tool>;
    
    /// Executes a tool call within this toolset
    async fn execute_tool(&self, call: ToolCall) -> HarnessResult<ToolResult>;
    
    /// Indicates if this toolset is enabled
    fn is_enabled(&self) -> bool;
    
    /// Enables or disables this toolset
    fn set_enabled(&mut self, enabled: bool);
}

/// ToolHandler trait for individual tool implementations
#[async_trait]
pub trait ToolHandler: Send + Sync {
    /// Returns the tool definition
    fn tool(&self) -> Tool;
    
    /// Executes the tool with the given parameters
    async fn execute(&self, call: ToolCall) -> HarnessResult<ToolResult>;
    
    /// Validates the tool call parameters
    fn validate(&self, call: &ToolCall) -> HarnessResult<()>;
}

/// PromptProvider trait for modules that provide prompts
#[async_trait]
pub trait PromptProvider: Send + Sync {
    /// Returns all prompts provided by this provider
    fn prompts(&self) -> Vec<Prompt>;
    
    /// Generates prompt messages for a given prompt name and arguments
    async fn get_prompt(&self, name: &str, arguments: serde_json::Value) -> HarnessResult<Vec<PromptMessage>>;
    
    /// Validates prompt arguments
    fn validate_prompt(&self, name: &str, arguments: &serde_json::Value) -> HarnessResult<()>;
}

/// ResourceProvider trait for modules that provide resources
#[async_trait]
pub trait ResourceProvider: Send + Sync {
    /// Returns all resources provided by this provider
    fn resources(&self) -> Vec<Resource>;
    
    /// Reads a resource by URI
    async fn read_resource(&self, uri: &str) -> HarnessResult<ResourceContent>;
    
    /// Lists available resources
    async fn list_resources(&self) -> HarnessResult<Vec<Resource>>;
}

/// Resource definition
#[derive(Debug, Clone)]
pub struct Resource {
    pub uri: String,
    pub name: String,
    pub description: Option<String>,
    pub mime_type: Option<String>,
}

/// Resource content
#[derive(Debug, Clone)]
pub struct ResourceContent {
    pub uri: String,
    pub mime_type: Option<String>,
    pub content: ResourceData,
}

/// Resource data variants
#[derive(Debug, Clone)]
pub enum ResourceData {
    Text(String),
    Binary(Vec<u8>),
    Json(serde_json::Value),
}

/// Authentication trait for different auth methods
#[async_trait]
pub trait Authenticator: Send + Sync {
    /// Authenticates a request and returns session information
    async fn authenticate(&self, credentials: &Credentials) -> HarnessResult<AuthSession>;
    
    /// Validates an existing session
    async fn validate_session(&self, session: &AuthSession) -> HarnessResult<bool>;
    
    /// Refreshes an authentication session if possible
    async fn refresh_session(&self, session: &AuthSession) -> HarnessResult<AuthSession>;
}

/// Credentials for authentication
#[derive(Debug, Clone)]
pub enum Credentials {
    ApiKey(String),
    BearerToken(String),
    UsernamePassword { username: String, password: String },
    Custom(serde_json::Value),
}

/// Authentication session
#[derive(Debug, Clone)]
pub struct AuthSession {
    pub account_id: String,
    pub user_id: Option<String>,
    pub org_id: Option<String>,
    pub project_id: Option<String>,
    pub expires_at: Option<chrono::DateTime<chrono::Utc>>,
    pub permissions: Vec<String>,
}

/// HTTP client trait for making API requests
#[async_trait]
pub trait HttpClient: Send + Sync {
    /// Makes a GET request
    async fn get<T>(&self, url: &str, headers: Option<std::collections::HashMap<String, String>>) -> HarnessResult<T>
    where
        T: for<'de> serde::Deserialize<'de>;
    
    /// Makes a POST request
    async fn post<T, B>(&self, url: &str, body: &B, headers: Option<std::collections::HashMap<String, String>>) -> HarnessResult<T>
    where
        T: for<'de> serde::Deserialize<'de>,
        B: serde::Serialize;
    
    /// Makes a PUT request
    async fn put<T, B>(&self, url: &str, body: &B, headers: Option<std::collections::HashMap<String, String>>) -> HarnessResult<T>
    where
        T: for<'de> serde::Deserialize<'de>,
        B: serde::Serialize;
    
    /// Makes a DELETE request
    async fn delete<T>(&self, url: &str, headers: Option<std::collections::HashMap<String, String>>) -> HarnessResult<T>
    where
        T: for<'de> serde::Deserialize<'de>;
}

/// Configuration provider trait
pub trait ConfigProvider: Send + Sync {
    /// Gets a configuration value by key
    fn get_string(&self, key: &str) -> Option<String>;
    
    /// Gets a boolean configuration value
    fn get_bool(&self, key: &str) -> Option<bool>;
    
    /// Gets an integer configuration value
    fn get_int(&self, key: &str) -> Option<i64>;
    
    /// Gets a list of strings
    fn get_string_list(&self, key: &str) -> Option<Vec<String>>;
    
    /// Checks if a key exists
    fn has_key(&self, key: &str) -> bool;
}

/// Event handler trait for processing events
#[async_trait]
pub trait EventHandler: Send + Sync {
    /// Handles an event
    async fn handle_event(&self, event: crate::harness::event::Event) -> Result<()>;
    
    /// Returns the event types this handler can process
    fn supported_event_types(&self) -> Vec<String>;
}

/// Logger trait for structured logging
pub trait Logger: Send + Sync {
    /// Logs a debug message
    fn debug(&self, message: &str, fields: Option<serde_json::Value>);
    
    /// Logs an info message
    fn info(&self, message: &str, fields: Option<serde_json::Value>);
    
    /// Logs a warning message
    fn warn(&self, message: &str, fields: Option<serde_json::Value>);
    
    /// Logs an error message
    fn error(&self, message: &str, fields: Option<serde_json::Value>);
}

/// Helper function for enabling toolsets safely
/// Converted from Go's ModuleEnableToolsets function
pub async fn module_enable_toolsets(
    module: &dyn Module,
    toolset_group: &mut dyn ToolsetGroup,
) -> Result<()> {
    // Only enable toolsets that exist in the toolset group
    let available_toolsets = toolset_group.list_toolsets();
    let existing_toolsets: Vec<String> = module
        .toolsets()
        .into_iter()
        .filter(|toolset_name| available_toolsets.contains(toolset_name))
        .collect();
    
    // Enable only the existing toolsets
    if existing_toolsets.is_empty() {
        return Ok(());
    }
    
    toolset_group.enable_toolsets(existing_toolsets).await
}