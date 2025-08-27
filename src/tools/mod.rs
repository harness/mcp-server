pub mod connectors;
pub mod pipelines;
pub mod common;

use crate::config::Config;
use crate::error::Result;

pub use connectors::*;
pub use pipelines::*;
pub use common::*;

/// Initialize and register all available tools based on configuration
pub fn initialize_tools(config: &Config) -> Result<Vec<Tool>> {
    let mut tools = Vec::new();

    // Add tools based on enabled toolsets
    for toolset in &config.toolsets {
        match toolset.as_str() {
            "default" | "all" => {
                tools.extend(get_default_tools(config)?);
            }
            "connectors" => {
                tools.extend(get_connector_tools(config)?);
            }
            "pipelines" => {
                tools.extend(get_pipeline_tools(config)?);
            }
            _ => {
                tracing::warn!("Unknown toolset: {}", toolset);
            }
        }
    }

    Ok(tools)
}

/// Placeholder tool structure
#[derive(Debug, Clone)]
pub struct Tool {
    pub name: String,
    pub description: String,
    pub input_schema: serde_json::Value,
}

fn get_default_tools(config: &Config) -> Result<Vec<Tool>> {
    let mut tools = Vec::new();
    tools.extend(get_connector_tools(config)?);
    tools.extend(get_pipeline_tools(config)?);
    Ok(tools)
}

fn get_connector_tools(_config: &Config) -> Result<Vec<Tool>> {
    Ok(vec![
        Tool {
            name: "list_connectors".to_string(),
            description: "List connectors in Harness".to_string(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "orgIdentifier": {
                        "type": "string",
                        "description": "Organization identifier"
                    },
                    "projectIdentifier": {
                        "type": "string",
                        "description": "Project identifier"
                    }
                }
            }),
        }
    ])
}

fn get_pipeline_tools(_config: &Config) -> Result<Vec<Tool>> {
    Ok(vec![
        Tool {
            name: "list_pipelines".to_string(),
            description: "List pipelines in Harness".to_string(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "orgIdentifier": {
                        "type": "string",
                        "description": "Organization identifier"
                    },
                    "projectIdentifier": {
                        "type": "string",
                        "description": "Project identifier"
                    }
                }
            }),
        }
    ])
}