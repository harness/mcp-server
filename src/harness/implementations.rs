// Default implementations of traits for Harness MCP Server

use anyhow::Result;
use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, info, warn, error};

use crate::config::Config;
use crate::harness::traits::*;
use crate::harness::tools::{Tool, ToolCall, ToolResult, ToolRegistry};
use crate::harness::prompts::{Prompt, PromptMessage, PromptRegistry};
use crate::harness::errors::{HarnessResult, HarnessError};

/// Default implementation of ToolsetGroup
pub struct DefaultToolsetGroup {
    toolsets: HashMap<String, Box<dyn Toolset>>,
    enabled_toolsets: Vec<String>,
}

impl DefaultToolsetGroup {
    pub fn new() -> Self {
        Self {
            toolsets: HashMap::new(),
            enabled_toolsets: Vec::new(),
        }
    }
}

#[async_trait]
impl ToolsetGroup for DefaultToolsetGroup {
    async fn add_toolset(&mut self, name: String, toolset: Box<dyn Toolset>) -> Result<()> {
        debug!("Adding toolset: {}", name);
        self.toolsets.insert(name, toolset);
        Ok(())
    }
    
    async fn enable_toolsets(&mut self, toolset_names: Vec<String>) -> Result<()> {
        for name in &toolset_names {
            if let Some(toolset) = self.toolsets.get_mut(name) {
                toolset.set_enabled(true);
                if !self.enabled_toolsets.contains(name) {
                    self.enabled_toolsets.push(name.clone());
                }
                info!("Enabled toolset: {}", name);
            } else {
                warn!("Attempted to enable non-existent toolset: {}", name);
            }
        }
        Ok(())
    }
    
    fn get_toolset(&self, name: &str) -> Option<&dyn Toolset> {
        self.toolsets.get(name).map(|t| t.as_ref())
    }
    
    fn list_toolsets(&self) -> Vec<String> {
        self.toolsets.keys().cloned().collect()
    }
}

/// Default implementation of Toolset
pub struct DefaultToolset {
    name: String,
    description: String,
    tools: Vec<Tool>,
    tool_handlers: HashMap<String, Box<dyn ToolHandler>>,
    enabled: bool,
}

impl DefaultToolset {
    pub fn new(name: String, description: String) -> Self {
        Self {
            name,
            description,
            tools: Vec::new(),
            tool_handlers: HashMap::new(),
            enabled: false,
        }
    }
    
    pub fn add_tool_handler(&mut self, handler: Box<dyn ToolHandler>) {
        let tool = handler.tool();
        let tool_name = tool.name.clone();
        self.tools.push(tool);
        self.tool_handlers.insert(tool_name, handler);
    }
}

#[async_trait]
impl Toolset for DefaultToolset {
    fn name(&self) -> &str {
        &self.name
    }
    
    fn description(&self) -> &str {
        &self.description
    }
    
    fn tools(&self) -> Vec<Tool> {
        self.tools.clone()
    }
    
    async fn execute_tool(&self, call: ToolCall) -> HarnessResult<ToolResult> {
        if !self.enabled {
            return Err(HarnessError::tool_execution(&call.name, "Toolset is not enabled"));
        }
        
        if let Some(handler) = self.tool_handlers.get(&call.name) {
            handler.validate(&call)?;
            handler.execute(call).await
        } else {
            Err(HarnessError::not_found("Tool", &call.name))
        }
    }
    
    fn is_enabled(&self) -> bool {
        self.enabled
    }
    
    fn set_enabled(&mut self, enabled: bool) {
        self.enabled = enabled;
    }
}

/// Default implementation of Module
pub struct DefaultModule {
    id: String,
    name: String,
    toolsets: Vec<String>,
    is_default: bool,
    toolset_group: Option<Arc<RwLock<DefaultToolsetGroup>>>,
}

impl DefaultModule {
    pub fn new(id: String, name: String, toolsets: Vec<String>, is_default: bool) -> Self {
        Self {
            id,
            name,
            toolsets,
            is_default,
            toolset_group: None,
        }
    }
    
    pub fn set_toolset_group(&mut self, toolset_group: Arc<RwLock<DefaultToolsetGroup>>) {
        self.toolset_group = Some(toolset_group);
    }
}

#[async_trait]
impl Module for DefaultModule {
    fn id(&self) -> &str {
        &self.id
    }
    
    fn name(&self) -> &str {
        &self.name
    }
    
    fn toolsets(&self) -> Vec<String> {
        self.toolsets.clone()
    }
    
    async fn register_toolsets(&self) -> Result<()> {
        debug!("Registering toolsets for module: {}", self.name);
        // Implementation would register specific toolsets based on module type
        Ok(())
    }
    
    async fn enable_toolsets(&self, toolset_group: &mut dyn ToolsetGroup) -> Result<()> {
        toolset_group.enable_toolsets(self.toolsets.clone()).await
    }
    
    fn is_default(&self) -> bool {
        self.is_default
    }
}

/// Default implementation of Authenticator for API key authentication
pub struct ApiKeyAuthenticator {
    config: Config,
}

impl ApiKeyAuthenticator {
    pub fn new(config: Config) -> Self {
        Self { config }
    }
}

#[async_trait]
impl Authenticator for ApiKeyAuthenticator {
    async fn authenticate(&self, credentials: &Credentials) -> HarnessResult<AuthSession> {
        match credentials {
            Credentials::ApiKey(api_key) => {
                // Extract account ID from API key (format: pat.ACCOUNT_ID.TOKEN_ID.<>)
                let parts: Vec<&str> = api_key.split('.').collect();
                if parts.len() < 2 {
                    return Err(HarnessError::authentication("Invalid API key format"));
                }
                
                let account_id = parts[1].to_string();
                
                Ok(AuthSession {
                    account_id,
                    user_id: None,
                    org_id: self.config.default_org_id.clone(),
                    project_id: self.config.default_project_id.clone(),
                    expires_at: None, // API keys don't expire
                    permissions: vec![], // Would be populated from API response
                })
            }
            _ => Err(HarnessError::authentication("Unsupported credential type")),
        }
    }
    
    async fn validate_session(&self, _session: &AuthSession) -> HarnessResult<bool> {
        // For API keys, we assume they're valid unless we get an auth error from API
        Ok(true)
    }
    
    async fn refresh_session(&self, session: &AuthSession) -> HarnessResult<AuthSession> {
        // API keys don't need refreshing
        Ok(session.clone())
    }
}

/// Default implementation of ConfigProvider
pub struct DefaultConfigProvider {
    config: Config,
}

impl DefaultConfigProvider {
    pub fn new(config: Config) -> Self {
        Self { config }
    }
}

impl ConfigProvider for DefaultConfigProvider {
    fn get_string(&self, key: &str) -> Option<String> {
        match key {
            "api_key" => Some(self.config.api_key.clone()),
            "base_url" => Some(self.config.base_url.clone()),
            "account_id" => Some(self.config.account_id.clone()),
            "default_org_id" => self.config.default_org_id.clone(),
            "default_project_id" => self.config.default_project_id.clone(),
            "version" => Some(self.config.version.clone()),
            _ => None,
        }
    }
    
    fn get_bool(&self, key: &str) -> Option<bool> {
        match key {
            "read_only" => Some(self.config.read_only),
            "debug" => Some(self.config.debug),
            "enable_license" => Some(self.config.enable_license),
            "internal" => Some(self.config.internal),
            _ => None,
        }
    }
    
    fn get_int(&self, _key: &str) -> Option<i64> {
        // No integer configs currently
        None
    }
    
    fn get_string_list(&self, key: &str) -> Option<Vec<String>> {
        match key {
            "toolsets" => Some(self.config.toolsets.clone()),
            "enable_modules" => Some(self.config.enable_modules.clone()),
            _ => None,
        }
    }
    
    fn has_key(&self, key: &str) -> bool {
        matches!(key, 
            "api_key" | "base_url" | "account_id" | "default_org_id" | 
            "default_project_id" | "version" | "read_only" | "debug" | 
            "enable_license" | "internal" | "toolsets" | "enable_modules"
        )
    }
}

/// Default implementation of Logger using tracing
pub struct DefaultLogger;

impl Logger for DefaultLogger {
    fn debug(&self, message: &str, fields: Option<serde_json::Value>) {
        if let Some(fields) = fields {
            debug!("{} - {}", message, fields);
        } else {
            debug!("{}", message);
        }
    }
    
    fn info(&self, message: &str, fields: Option<serde_json::Value>) {
        if let Some(fields) = fields {
            info!("{} - {}", message, fields);
        } else {
            info!("{}", message);
        }
    }
    
    fn warn(&self, message: &str, fields: Option<serde_json::Value>) {
        if let Some(fields) = fields {
            warn!("{} - {}", message, fields);
        } else {
            warn!("{}", message);
        }
    }
    
    fn error(&self, message: &str, fields: Option<serde_json::Value>) {
        if let Some(fields) = fields {
            error!("{} - {}", message, fields);
        } else {
            error!("{}", message);
        }
    }
}

/// Default implementation of EventHandler
pub struct DefaultEventHandler {
    logger: DefaultLogger,
}

impl DefaultEventHandler {
    pub fn new() -> Self {
        Self {
            logger: DefaultLogger,
        }
    }
}

#[async_trait]
impl EventHandler for DefaultEventHandler {
    async fn handle_event(&self, event: crate::harness::event::Event) -> Result<()> {
        self.logger.info(
            "Handling event",
            Some(serde_json::json!({
                "event_type": event.event_type,
                "timestamp": event.timestamp
            }))
        );
        
        // Default implementation just logs the event
        // Specific implementations would process events appropriately
        Ok(())
    }
    
    fn supported_event_types(&self) -> Vec<String> {
        vec!["*".to_string()] // Support all event types by default
    }
}