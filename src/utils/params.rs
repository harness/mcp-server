use crate::error::{HarnessError, Result};
use serde_json::Value;
use std::collections::HashMap;

/// Extract a required parameter from a map
pub fn required_param<T>(
    params: &HashMap<String, Value>,
    key: &str,
) -> Result<T>
where
    T: serde::de::DeserializeOwned,
{
    let value = params
        .get(key)
        .ok_or_else(|| HarnessError::validation(format!("Missing required parameter: {}", key)))?;
    
    serde_json::from_value(value.clone())
        .map_err(|e| HarnessError::validation(format!("Invalid parameter '{}': {}", key, e)))
}

/// Extract an optional parameter from a map
pub fn optional_param<T>(
    params: &HashMap<String, Value>,
    key: &str,
) -> Result<Option<T>>
where
    T: serde::de::DeserializeOwned,
{
    match params.get(key) {
        Some(value) => {
            if value.is_null() {
                Ok(None)
            } else {
                let parsed = serde_json::from_value(value.clone())
                    .map_err(|e| HarnessError::validation(format!("Invalid parameter '{}': {}", key, e)))?;
                Ok(Some(parsed))
            }
        }
        None => Ok(None),
    }
}

/// Extract a required string parameter
pub fn required_string(params: &HashMap<String, Value>, key: &str) -> Result<String> {
    required_param(params, key)
}

/// Extract an optional string parameter
pub fn optional_string(params: &HashMap<String, Value>, key: &str) -> Result<Option<String>> {
    optional_param(params, key)
}

/// Extract a required integer parameter
pub fn required_i64(params: &HashMap<String, Value>, key: &str) -> Result<i64> {
    required_param(params, key)
}

/// Extract an optional integer parameter
pub fn optional_i64(params: &HashMap<String, Value>, key: &str) -> Result<Option<i64>> {
    optional_param(params, key)
}

/// Extract a required integer parameter as i32
pub fn required_i32(params: &HashMap<String, Value>, key: &str) -> Result<i32> {
    required_param(params, key)
}

/// Extract an optional integer parameter as i32
pub fn optional_i32(params: &HashMap<String, Value>, key: &str) -> Result<Option<i32>> {
    optional_param(params, key)
}

/// Extract a required boolean parameter
pub fn required_bool(params: &HashMap<String, Value>, key: &str) -> Result<bool> {
    required_param(params, key)
}

/// Extract an optional boolean parameter
pub fn optional_bool(params: &HashMap<String, Value>, key: &str) -> Result<Option<bool>> {
    optional_param(params, key)
}

/// Extract pagination parameters with defaults
pub fn extract_pagination(params: &HashMap<String, Value>) -> Result<(i32, i32)> {
    let page = optional_i32(params, "page")?.unwrap_or(0);
    let limit = optional_i32(params, "limit")?.unwrap_or(10);
    
    if page < 0 {
        return Err(HarnessError::validation("Page must be non-negative"));
    }
    
    if limit <= 0 || limit > 1000 {
        return Err(HarnessError::validation("Limit must be between 1 and 1000"));
    }
    
    Ok((page, limit))
}

/// Extract scope parameters (account, org, project)
pub fn extract_scope(params: &HashMap<String, Value>) -> Result<(String, Option<String>, Option<String>)> {
    let account_id = required_string(params, "accountIdentifier")?;
    let org_id = optional_string(params, "orgIdentifier")?;
    let project_id = optional_string(params, "projectIdentifier")?;
    
    Ok((account_id, org_id, project_id))
}

/// Validate that a string parameter is not empty
pub fn validate_non_empty(value: &str, param_name: &str) -> Result<()> {
    if value.trim().is_empty() {
        return Err(HarnessError::validation(format!("{} cannot be empty", param_name)));
    }
    Ok(())
}

/// Extract and validate a required non-empty string
pub fn required_non_empty_string(params: &HashMap<String, Value>, key: &str) -> Result<String> {
    let value = required_string(params, key)?;
    validate_non_empty(&value, key)?;
    Ok(value)
}

/// Extract search term with trimming
pub fn extract_search_term(params: &HashMap<String, Value>) -> Result<Option<String>> {
    match optional_string(params, "searchTerm")? {
        Some(term) => {
            let trimmed = term.trim();
            if trimmed.is_empty() {
                Ok(None)
            } else {
                Ok(Some(trimmed.to_string()))
            }
        }
        None => Ok(None),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_required_param() {
        let mut params = HashMap::new();
        params.insert("test".to_string(), json!("value"));
        
        let result: Result<String> = required_param(&params, "test");
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "value");
        
        let missing: Result<String> = required_param(&params, "missing");
        assert!(missing.is_err());
    }

    #[test]
    fn test_optional_param() {
        let mut params = HashMap::new();
        params.insert("test".to_string(), json!("value"));
        params.insert("null".to_string(), json!(null));
        
        let result: Result<Option<String>> = optional_param(&params, "test");
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), Some("value".to_string()));
        
        let null_result: Result<Option<String>> = optional_param(&params, "null");
        assert!(null_result.is_ok());
        assert_eq!(null_result.unwrap(), None);
        
        let missing: Result<Option<String>> = optional_param(&params, "missing");
        assert!(missing.is_ok());
        assert_eq!(missing.unwrap(), None);
    }

    #[test]
    fn test_extract_pagination() {
        let mut params = HashMap::new();
        params.insert("page".to_string(), json!(2));
        params.insert("limit".to_string(), json!(50));
        
        let result = extract_pagination(&params);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), (2, 50));
        
        // Test defaults
        let empty_params = HashMap::new();
        let default_result = extract_pagination(&empty_params);
        assert!(default_result.is_ok());
        assert_eq!(default_result.unwrap(), (0, 10));
    }

    #[test]
    fn test_extract_scope() {
        let mut params = HashMap::new();
        params.insert("accountIdentifier".to_string(), json!("acc123"));
        params.insert("orgIdentifier".to_string(), json!("org123"));
        params.insert("projectIdentifier".to_string(), json!("proj123"));
        
        let result = extract_scope(&params);
        assert!(result.is_ok());
        let (account, org, project) = result.unwrap();
        assert_eq!(account, "acc123");
        assert_eq!(org, Some("org123".to_string()));
        assert_eq!(project, Some("proj123".to_string()));
    }
}