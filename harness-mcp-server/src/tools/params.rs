use serde::de::DeserializeOwned;
use serde_json::Value;
use std::collections::HashMap;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ParamError {
    #[error("Missing required parameter: {0}")]
    MissingRequired(String),
    
    #[error("Parameter {param} is not of expected type: {error}")]
    InvalidType { param: String, error: String },
    
    #[error("Parameter {param} has invalid value: {error}")]
    InvalidValue { param: String, error: String },
}

pub type ParamResult<T> = Result<T, ParamError>;

/// Extract a required parameter from MCP request arguments
pub fn required_param<T: DeserializeOwned>(
    args: &HashMap<String, Value>,
    param_name: &str,
) -> ParamResult<T> {
    let value = args.get(param_name)
        .ok_or_else(|| ParamError::MissingRequired(param_name.to_string()))?;
    
    serde_json::from_value(value.clone())
        .map_err(|e| ParamError::InvalidType {
            param: param_name.to_string(),
            error: e.to_string(),
        })
}

/// Extract an optional parameter from MCP request arguments
pub fn optional_param<T: DeserializeOwned>(
    args: &HashMap<String, Value>,
    param_name: &str,
) -> ParamResult<Option<T>> {
    match args.get(param_name) {
        Some(value) => {
            if value.is_null() {
                Ok(None)
            } else {
                let parsed = serde_json::from_value(value.clone())
                    .map_err(|e| ParamError::InvalidType {
                        param: param_name.to_string(),
                        error: e.to_string(),
                    })?;
                Ok(Some(parsed))
            }
        }
        None => Ok(None),
    }
}

/// Extract an optional parameter with a default value
pub fn optional_param_with_default<T: DeserializeOwned>(
    args: &HashMap<String, Value>,
    param_name: &str,
    default: T,
) -> ParamResult<T> {
    match optional_param(args, param_name)? {
        Some(value) => Ok(value),
        None => Ok(default),
    }
}

/// Extract pagination parameters (page and size)
pub fn fetch_pagination(args: &HashMap<String, Value>) -> ParamResult<(i32, i32)> {
    let page = optional_param_with_default(args, "page", 0)?;
    let size = optional_param_with_default(args, "size", 20)?;
    
    // Validate pagination parameters
    if page < 0 {
        return Err(ParamError::InvalidValue {
            param: "page".to_string(),
            error: "Page must be non-negative".to_string(),
        });
    }
    
    if size <= 0 || size > 100 {
        return Err(ParamError::InvalidValue {
            param: "size".to_string(),
            error: "Size must be between 1 and 100".to_string(),
        });
    }
    
    Ok((page, size))
}

/// Extract an integer parameter (handles float to int conversion)
pub fn optional_int_param(
    args: &HashMap<String, Value>,
    param_name: &str,
) -> ParamResult<Option<i32>> {
    match args.get(param_name) {
        Some(value) => {
            if value.is_null() {
                Ok(None)
            } else if let Some(i) = value.as_i64() {
                Ok(Some(i as i32))
            } else if let Some(f) = value.as_f64() {
                Ok(Some(f as i32))
            } else {
                Err(ParamError::InvalidType {
                    param: param_name.to_string(),
                    error: "Expected number".to_string(),
                })
            }
        }
        None => Ok(None),
    }
}

/// Extract an integer parameter with default
pub fn optional_int_param_with_default(
    args: &HashMap<String, Value>,
    param_name: &str,
    default: i32,
) -> ParamResult<i32> {
    match optional_int_param(args, param_name)? {
        Some(value) => Ok(value),
        None => Ok(default),
    }
}

/// Extract a string array parameter
pub fn optional_string_array_param(
    args: &HashMap<String, Value>,
    param_name: &str,
) -> ParamResult<Option<Vec<String>>> {
    match args.get(param_name) {
        Some(value) => {
            if value.is_null() {
                Ok(None)
            } else if let Some(arr) = value.as_array() {
                let mut strings = Vec::new();
                for item in arr {
                    if let Some(s) = item.as_str() {
                        strings.push(s.to_string());
                    } else {
                        return Err(ParamError::InvalidType {
                            param: param_name.to_string(),
                            error: "Array must contain only strings".to_string(),
                        });
                    }
                }
                Ok(Some(strings))
            } else {
                Err(ParamError::InvalidType {
                    param: param_name.to_string(),
                    error: "Expected array".to_string(),
                })
            }
        }
        None => Ok(None),
    }
}

/// Extract any array parameter
pub fn optional_any_array_param(
    args: &HashMap<String, Value>,
    param_name: &str,
) -> ParamResult<Option<Vec<Value>>> {
    match args.get(param_name) {
        Some(value) => {
            if value.is_null() {
                Ok(None)
            } else if let Some(arr) = value.as_array() {
                Ok(Some(arr.clone()))
            } else {
                Err(ParamError::InvalidType {
                    param: param_name.to_string(),
                    error: "Expected array".to_string(),
                })
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
        let mut args = HashMap::new();
        args.insert("test".to_string(), json!("value"));
        
        let result: ParamResult<String> = required_param(&args, "test");
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "value");
        
        let missing: ParamResult<String> = required_param(&args, "missing");
        assert!(missing.is_err());
    }

    #[test]
    fn test_optional_param() {
        let mut args = HashMap::new();
        args.insert("test".to_string(), json!("value"));
        args.insert("null_test".to_string(), json!(null));
        
        let result: ParamResult<Option<String>> = optional_param(&args, "test");
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), Some("value".to_string()));
        
        let null_result: ParamResult<Option<String>> = optional_param(&args, "null_test");
        assert!(null_result.is_ok());
        assert_eq!(null_result.unwrap(), None);
        
        let missing: ParamResult<Option<String>> = optional_param(&args, "missing");
        assert!(missing.is_ok());
        assert_eq!(missing.unwrap(), None);
    }

    #[test]
    fn test_fetch_pagination() {
        let mut args = HashMap::new();
        args.insert("page".to_string(), json!(1));
        args.insert("size".to_string(), json!(10));
        
        let result = fetch_pagination(&args);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), (1, 10));
        
        // Test defaults
        let empty_args = HashMap::new();
        let default_result = fetch_pagination(&empty_args);
        assert!(default_result.is_ok());
        assert_eq!(default_result.unwrap(), (0, 20));
    }
}