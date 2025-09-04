// Utility functions

use anyhow::Result;
use chrono::{DateTime, Utc};
use serde_json::Value;

pub fn format_timestamp(timestamp: Option<DateTime<Utc>>) -> String {
    match timestamp {
        Some(ts) => ts.format("%Y-%m-%d %H:%M:%S UTC").to_string(),
        None => "N/A".to_string(),
    }
}

pub fn parse_json_safely(json_str: &str) -> Result<Value> {
    serde_json::from_str(json_str).map_err(|e| anyhow::anyhow!("Failed to parse JSON: {}", e))
}

pub fn sanitize_identifier(input: &str) -> String {
    input
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '_' || *c == '-')
        .collect()
}

pub fn truncate_string(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        format!("{}...", &s[..max_len.saturating_sub(3)])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_identifier() {
        assert_eq!(sanitize_identifier("test-id_123"), "test-id_123");
        assert_eq!(sanitize_identifier("test@#$%id"), "testid");
    }

    #[test]
    fn test_truncate_string() {
        assert_eq!(truncate_string("hello", 10), "hello");
        assert_eq!(truncate_string("hello world", 8), "hello...");
    }

    #[test]
    fn test_parse_json_safely() {
        let valid_json = r#"{"key": "value"}"#;
        let result = parse_json_safely(valid_json);
        assert!(result.is_ok());

        let invalid_json = r#"{"key": value}"#;
        let result = parse_json_safely(invalid_json);
        assert!(result.is_err());
    }
}