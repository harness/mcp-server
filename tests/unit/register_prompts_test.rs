use crate::config::Config;
use crate::harness::prompts::{PromptFile, PromptMetadata};
use crate::prompts::{Mode, Prompt, Prompts};
use serde_json;
use std::collections::HashMap;

/// Mock function to simulate GetModulePrompts
fn mock_get_module_prompts(module: &str, is_internal: bool, mode: &str) -> Result<Vec<PromptFile>, Box<dyn std::error::Error>> {
    match mode {
        "standard" => Ok(vec![PromptFile {
            metadata: PromptMetadata {
                description: "Testmodule prompt description".to_string(),
                result_description: "Testmodule prompt result description".to_string(),
                module: "testmodule".to_string(),
            },
            content: "Standard content".to_string(),
            file_path: "files/internal/standard/testmodule.txt".to_string(),
        }]),
        "architect" => Ok(vec![PromptFile {
            metadata: PromptMetadata {
                description: "Testmodule prompt description".to_string(),
                result_description: "Testmodule prompt result description".to_string(),
                module: "testmodule".to_string(),
            },
            content: "Architect content".to_string(),
            file_path: "files/internal/architect/testmodule.txt".to_string(),
        }]),
        _ => Ok(vec![]),
    }
}

/// Copy of register_prompts function for testing
fn register_prompts_copy(
    module_id: &str,
    cfg: &Config,
) -> Result<Option<Prompt>, Box<dyn std::error::Error>> {
    // Create a map to store prompts by mode
    let mut module_prompts_by_mode: HashMap<String, Vec<PromptFile>> = HashMap::new();
    module_prompts_by_mode.insert("standard".to_string(), vec![]);
    module_prompts_by_mode.insert("architect".to_string(), vec![]);

    // Get module-specific prompts for standard mode
    let standard_prompts = mock_get_module_prompts(
        &module_id.to_lowercase(),
        cfg.internal,
        "standard",
    )?;
    module_prompts_by_mode.insert("standard".to_string(), standard_prompts);

    // Get module-specific prompts for architect mode (only for internal)
    if cfg.internal {
        let architect_prompts = mock_get_module_prompts(
            &module_id.to_lowercase(),
            cfg.internal,
            "architect",
        )?;
        module_prompts_by_mode.insert("architect".to_string(), architect_prompts);
    }

    // Check if we have any prompts for this module
    let total_prompts: usize = module_prompts_by_mode.values().map(|v| v.len()).sum();
    if total_prompts == 0 {
        // No prompts for this module
        return Ok(None);
    }

    // Create a map to store combined content for each mode
    let mut mode_contents: HashMap<String, String> = HashMap::new();

    // Get description and result description from the first available prompt
    let mut description = String::new();
    let mut result_description = String::new();

    // Process each mode separately to build the content map
    for (mode, mode_prompts) in &module_prompts_by_mode {
        if mode_prompts.is_empty() {
            continue; // Skip empty modes
        }

        // Use the first prompt's metadata for description and result description if not already set
        if description.is_empty() && !mode_prompts[0].metadata.description.is_empty() {
            description = mode_prompts[0].metadata.description.clone();
        }

        if result_description.is_empty() && !mode_prompts[0].metadata.result_description.is_empty() {
            result_description = mode_prompts[0].metadata.result_description.clone();
        }

        // Combine all prompt contents for this mode
        let mut combined_content = Vec::new();
        for prompt_file in mode_prompts {
            if !prompt_file.content.is_empty() {
                combined_content.push(prompt_file.content.clone());
            }
        }

        // Store the combined content for this mode
        mode_contents.insert(mode.clone(), combined_content.join("\n\n"));
    }

    // Convert the mode contents map to JSON
    let content_json = serde_json::to_string(&mode_contents)?;

    // Create a single MCP prompt with the module ID as the name
    let mcp_prompt = Prompt::new()
        .set_name(&module_id.to_uppercase()) // Use moduleID as the prompt name
        .set_description(&description)
        .set_result_description(&result_description)
        .set_text(&content_json) // Store the JSON map as the prompt text
        .build();

    Ok(Some(mcp_prompt))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_register_prompts() {
        let cfg = Config {
            internal: true,
            ..Default::default()
        };

        // Use our test version of register_prompts
        let prompt = register_prompts_copy("testmodule", &cfg)
            .expect("register_prompts should not return error")
            .expect("register_prompts should return a prompt");

        assert_eq!(prompt.name, "TESTMODULE");
        assert!(prompt.description.contains("Testmodule prompt description"));
        assert!(prompt.result_description.contains("Testmodule prompt result description"));

        // Verify JSON text contains both modes
        let mode_contents: HashMap<String, String> = serde_json::from_str(&prompt.text)
            .expect("prompt text should be valid JSON");

        assert_eq!(
            mode_contents.get("standard").unwrap(),
            "Standard content"
        );
        assert_eq!(
            mode_contents.get("architect").unwrap(),
            "Architect content"
        );
    }

    #[test]
    fn test_register_prompts_external_config() {
        let cfg = Config {
            internal: false,
            ..Default::default()
        };

        let prompt = register_prompts_copy("testmodule", &cfg)
            .expect("register_prompts should not return error")
            .expect("register_prompts should return a prompt");

        // Verify JSON text contains only standard mode for external config
        let mode_contents: HashMap<String, String> = serde_json::from_str(&prompt.text)
            .expect("prompt text should be valid JSON");

        assert_eq!(
            mode_contents.get("standard").unwrap(),
            "Standard content"
        );
        assert!(!mode_contents.contains_key("architect"));
    }

    #[test]
    fn test_mock_get_module_prompts_standard() {
        let prompts = mock_get_module_prompts("testmodule", true, "standard")
            .expect("should return prompts");

        assert_eq!(prompts.len(), 1);
        assert_eq!(prompts[0].content, "Standard content");
        assert_eq!(prompts[0].metadata.module, "testmodule");
    }

    #[test]
    fn test_mock_get_module_prompts_architect() {
        let prompts = mock_get_module_prompts("testmodule", true, "architect")
            .expect("should return prompts");

        assert_eq!(prompts.len(), 1);
        assert_eq!(prompts[0].content, "Architect content");
        assert_eq!(prompts[0].metadata.module, "testmodule");
    }

    #[test]
    fn test_mock_get_module_prompts_unknown_mode() {
        let prompts = mock_get_module_prompts("testmodule", true, "unknown")
            .expect("should return empty prompts");

        assert_eq!(prompts.len(), 0);
    }
}