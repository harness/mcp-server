use crate::types::HarnessError;
use std::time::{SystemTime, UNIX_EPOCH};

/// Utility functions for the Harness MCP server

/// Get current timestamp in milliseconds
pub fn current_timestamp_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

/// Validate that a string is a valid identifier
pub fn validate_identifier(id: &str, field_name: &str) -> Result<(), HarnessError> {
    if id.is_empty() {
        return Err(HarnessError::Validation(format!(
            "{} cannot be empty",
            field_name
        )));
    }

    // Check for valid identifier characters (alphanumeric, underscore, hyphen)
    if !id.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '-') {
        return Err(HarnessError::Validation(format!(
            "{} contains invalid characters. Only alphanumeric, underscore, and hyphen are allowed",
            field_name
        )));
    }

    Ok(())
}

/// Sanitize a string for use in URLs
pub fn sanitize_for_url(input: &str) -> String {
    input
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
        .collect()
}

/// Convert a string to kebab-case
pub fn to_kebab_case(input: &str) -> String {
    input
        .chars()
        .enumerate()
        .map(|(i, c)| {
            if c.is_uppercase() && i > 0 {
                format!("-{}", c.to_lowercase())
            } else {
                c.to_lowercase().to_string()
            }
        })
        .collect()
}

/// Convert a string to snake_case
pub fn to_snake_case(input: &str) -> String {
    input
        .chars()
        .enumerate()
        .map(|(i, c)| {
            if c.is_uppercase() && i > 0 {
                format!("_{}", c.to_lowercase())
            } else {
                c.to_lowercase().to_string()
            }
        })
        .collect()
}

/// Truncate a string to a maximum length
pub fn truncate_string(input: &str, max_length: usize) -> String {
    if input.len() <= max_length {
        input.to_string()
    } else {
        format!("{}...", &input[..max_length.saturating_sub(3)])
    }
}

/// Parse a comma-separated string into a vector
pub fn parse_comma_separated(input: &str) -> Vec<String> {
    if input.trim().is_empty() {
        return Vec::new();
    }

    input
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect()
}

/// Join a vector of strings with commas
pub fn join_with_commas(items: &[String]) -> String {
    items.join(", ")
}

/// Retry logic with exponential backoff
pub async fn retry_with_backoff<F, T, E>(
    mut operation: F,
    max_retries: usize,
    initial_delay_ms: u64,
) -> Result<T, E>
where
    F: FnMut() -> Result<T, E>,
    E: std::fmt::Debug,
{
    let mut delay = initial_delay_ms;
    
    for attempt in 0..=max_retries {
        match operation() {
            Ok(result) => return Ok(result),
            Err(e) => {
                if attempt == max_retries {
                    return Err(e);
                }
                
                tracing::warn!("Operation failed on attempt {}, retrying in {}ms: {:?}", attempt + 1, delay, e);
                tokio::time::sleep(tokio::time::Duration::from_millis(delay)).await;
                delay *= 2; // Exponential backoff
            }
        }
    }
    
    unreachable!()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_identifier() {
        assert!(validate_identifier("valid_id", "test").is_ok());
        assert!(validate_identifier("valid-id", "test").is_ok());
        assert!(validate_identifier("validId123", "test").is_ok());
        assert!(validate_identifier("", "test").is_err());
        assert!(validate_identifier("invalid id", "test").is_err());
        assert!(validate_identifier("invalid@id", "test").is_err());
    }

    #[test]
    fn test_to_kebab_case() {
        assert_eq!(to_kebab_case("CamelCase"), "camel-case");
        assert_eq!(to_kebab_case("simpleword"), "simpleword");
        assert_eq!(to_kebab_case("XMLHttpRequest"), "xml-http-request");
    }

    #[test]
    fn test_to_snake_case() {
        assert_eq!(to_snake_case("CamelCase"), "camel_case");
        assert_eq!(to_snake_case("simpleword"), "simpleword");
        assert_eq!(to_snake_case("XMLHttpRequest"), "xml_http_request");
    }

    #[test]
    fn test_parse_comma_separated() {
        assert_eq!(parse_comma_separated("a,b,c"), vec!["a", "b", "c"]);
        assert_eq!(parse_comma_separated("a, b , c "), vec!["a", "b", "c"]);
        assert_eq!(parse_comma_separated(""), Vec::<String>::new());
        assert_eq!(parse_comma_separated("single"), vec!["single"]);
    }

    #[test]
    fn test_truncate_string() {
        assert_eq!(truncate_string("short", 10), "short");
        assert_eq!(truncate_string("this is a very long string", 10), "this is...");
        assert_eq!(truncate_string("exactly10c", 10), "exactly10c");
    }
}