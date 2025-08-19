// Prompts module for Harness MCP Server
// Handles prompt templates and dynamic prompt generation

use anyhow::Result;
use serde::{Deserialize, Serialize};
use crate::harness::errors::HarnessResult;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Prompt {
    pub name: String,
    pub description: String,
    pub arguments: Vec<PromptArgument>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptArgument {
    pub name: String,
    pub description: String,
    pub required: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptMessage {
    pub role: String,
    pub content: PromptContent,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptContent {
    pub r#type: String,
    pub text: String,
}

pub struct PromptRegistry {
    prompts: Vec<Prompt>,
}

impl PromptRegistry {
    pub fn new() -> Self {
        Self {
            prompts: Vec::new(),
        }
    }
    
    pub fn register_prompt(&mut self, prompt: Prompt) {
        self.prompts.push(prompt);
    }
    
    pub fn list_prompts(&self) -> &[Prompt] {
        &self.prompts
    }
    
    pub async fn get_prompt(&self, name: &str, arguments: serde_json::Value) -> HarnessResult<Vec<PromptMessage>> {
        // TODO: Implement prompt generation logic
        // This would load prompt templates and substitute arguments
        
        Ok(vec![PromptMessage {
            role: "user".to_string(),
            content: PromptContent {
                r#type: "text".to_string(),
                text: format!("Prompt '{}' not yet implemented", name),
            },
        }])
    }
}