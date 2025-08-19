// Utility functions for Harness MCP Server

use anyhow::Result;

pub fn format_error(error: &anyhow::Error) -> String {
    format!("Error: {}", error)
}

pub fn validate_identifier(identifier: &str) -> Result<()> {
    if identifier.is_empty() {
        anyhow::bail!("Identifier cannot be empty");
    }
    
    if !identifier.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '-') {
        anyhow::bail!("Identifier can only contain alphanumeric characters, underscores, and hyphens");
    }
    
    Ok(())
}

pub fn sanitize_string(input: &str) -> String {
    input.trim().to_string()
}