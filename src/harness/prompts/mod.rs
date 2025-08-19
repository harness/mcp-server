// Prompts module
// This will be populated during the conversion process

use anyhow::Result;

pub struct PromptsRegistry {
    // TODO: Implement prompts registry
}

impl PromptsRegistry {
    pub fn new() -> Self {
        Self {}
    }

    pub async fn list_prompts(&self) -> Result<Vec<serde_json::Value>> {
        // TODO: Implement prompts listing
        Ok(vec![])
    }
}