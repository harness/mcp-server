// Prompt management for MCP resources

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Prompt {
    pub name: String,
    pub description: String,
    pub content: String,
    pub arguments: Vec<PromptArgument>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptArgument {
    pub name: String,
    pub description: String,
    pub required: bool,
    pub argument_type: String,
}

pub struct PromptRegistry {
    prompts: HashMap<String, Prompt>,
}

impl PromptRegistry {
    pub fn new() -> Self {
        Self {
            prompts: HashMap::new(),
        }
    }

    pub fn register_prompt(&mut self, prompt: Prompt) {
        self.prompts.insert(prompt.name.clone(), prompt);
    }

    pub fn get_prompt(&self, name: &str) -> Option<&Prompt> {
        self.prompts.get(name)
    }

    pub fn list_prompts(&self) -> Vec<&Prompt> {
        self.prompts.values().collect()
    }

    pub fn load_default_prompts(&mut self) -> Result<()> {
        // TODO: Load default prompts from embedded resources
        // This would include prompts for various Harness operations
        
        // Example prompt
        let pipeline_prompt = Prompt {
            name: "create_pipeline".to_string(),
            description: "Create a new Harness pipeline".to_string(),
            content: "Create a pipeline with the following specifications...".to_string(),
            arguments: vec![
                PromptArgument {
                    name: "name".to_string(),
                    description: "Pipeline name".to_string(),
                    required: true,
                    argument_type: "string".to_string(),
                },
                PromptArgument {
                    name: "description".to_string(),
                    description: "Pipeline description".to_string(),
                    required: false,
                    argument_type: "string".to_string(),
                },
            ],
        };
        
        self.register_prompt(pipeline_prompt);
        
        Ok(())
    }
}

impl Default for PromptRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_prompt_registry() {
        let mut registry = PromptRegistry::new();
        
        let prompt = Prompt {
            name: "test_prompt".to_string(),
            description: "Test prompt".to_string(),
            content: "Test content".to_string(),
            arguments: vec![],
        };
        
        registry.register_prompt(prompt);
        
        let retrieved = registry.get_prompt("test_prompt");
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().name, "test_prompt");
    }
}