// Toolsets for MCP tools

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::config::Config;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tool {
    pub name: String,
    pub description: String,
    pub input_schema: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Toolset {
    pub name: String,
    pub description: String,
    pub tools: Vec<Tool>,
}

pub struct ToolsetRegistry {
    toolsets: HashMap<String, Toolset>,
}

impl ToolsetRegistry {
    pub fn new() -> Self {
        Self {
            toolsets: HashMap::new(),
        }
    }

    pub fn register_toolset(&mut self, toolset: Toolset) {
        self.toolsets.insert(toolset.name.clone(), toolset);
    }

    pub fn get_toolset(&self, name: &str) -> Option<&Toolset> {
        self.toolsets.get(name)
    }

    pub fn get_enabled_toolsets(&self, config: &Config) -> Vec<&Toolset> {
        self.toolsets
            .values()
            .filter(|ts| config.toolsets.contains(&ts.name))
            .collect()
    }

    pub fn get_all_tools(&self, config: &Config) -> Vec<&Tool> {
        self.get_enabled_toolsets(config)
            .into_iter()
            .flat_map(|ts| &ts.tools)
            .collect()
    }

    pub fn load_default_toolsets(&mut self) -> Result<()> {
        // TODO: Load default toolsets
        // This would include all the toolsets from the Go implementation
        
        // Example default toolset
        let default_toolset = Toolset {
            name: "default".to_string(),
            description: "Default Harness toolset".to_string(),
            tools: vec![
                Tool {
                    name: "get_connector_details".to_string(),
                    description: "Get details of a specific connector".to_string(),
                    input_schema: serde_json::json!({
                        "type": "object",
                        "properties": {
                            "connector_id": {
                                "type": "string",
                                "description": "Connector identifier"
                            }
                        },
                        "required": ["connector_id"]
                    }),
                },
                Tool {
                    name: "list_connectors".to_string(),
                    description: "List connectors with filtering options".to_string(),
                    input_schema: serde_json::json!({
                        "type": "object",
                        "properties": {
                            "page": {
                                "type": "integer",
                                "description": "Page number",
                                "default": 0
                            },
                            "size": {
                                "type": "integer", 
                                "description": "Page size",
                                "default": 50
                            }
                        }
                    }),
                },
            ],
        };
        
        self.register_toolset(default_toolset);
        
        Ok(())
    }
}

impl Default for ToolsetRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    fn create_test_config() -> Config {
        let mut toolsets = HashSet::new();
        toolsets.insert("default".to_string());
        
        Config {
            base_url: "https://app.harness.io".to_string(),
            api_key: "pat.test_account.test_token.xyz".to_string(),
            account_id: "test_account".to_string(),
            org_id: Some("test_org".to_string()),
            project_id: Some("test_project".to_string()),
            toolsets,
            read_only: false,
        }
    }

    #[test]
    fn test_toolset_registry() {
        let mut registry = ToolsetRegistry::new();
        registry.load_default_toolsets().unwrap();
        
        let config = create_test_config();
        let enabled_toolsets = registry.get_enabled_toolsets(&config);
        
        assert_eq!(enabled_toolsets.len(), 1);
        assert_eq!(enabled_toolsets[0].name, "default");
    }
}