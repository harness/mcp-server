use crate::ToolError;
use serde::{Deserialize, de::DeserializeOwned};
use serde_json::{Value, Map};
use std::collections::HashMap;

/// Tool request arguments type
pub type ToolArguments = Map<String, Value>;

/// Mock tool request structure for parameter extraction
/// This will be replaced with actual MCP request type when available
#[derive(Debug, Clone)]
pub struct ToolRequest {
    pub arguments: ToolArguments,
}

impl ToolRequest {
    pub fn new(arguments: ToolArguments) -> Self {
        Self { arguments }
    }

    pub fn get_arguments(&self) -> &ToolArguments {
        &self.arguments
    }
}

/// Extract a required parameter from tool request
/// Migrated from Go RequiredParam function
pub fn required_param<T>(request: &ToolRequest, param_name: &str) -> Result<T, ToolError>
where
    T: DeserializeOwned + PartialEq + Default,
{
    let value = request.get_arguments()
        .get(param_name)
        .ok_or_else(|| ToolError::InvalidArguments {
            message: format!("Missing required parameter: {}", param_name),
        })?;

    let parsed: T = serde_json::from_value(value.clone())
        .map_err(|_| ToolError::InvalidArguments {
            message: format!("Parameter {} is not of expected type", param_name),
        })?;

    // Check for zero/default values
    if parsed == T::default() {
        return Err(ToolError::InvalidArguments {
            message: format!("Missing required parameter: {}", param_name),
        });
    }

    Ok(parsed)
}

/// Extract an optional parameter from tool request
/// Migrated from Go OptionalParam function
pub fn optional_param<T>(request: &ToolRequest, param_name: &str) -> Result<Option<T>, ToolError>
where
    T: DeserializeOwned,
{
    match request.get_arguments().get(param_name) {
        Some(value) => {
            let parsed: T = serde_json::from_value(value.clone())
                .map_err(|_| ToolError::InvalidArguments {
                    message: format!("Parameter {} is not of expected type", param_name),
                })?;
            Ok(Some(parsed))
        }
        None => Ok(None),
    }
}

/// Extract an optional parameter with a default value
pub fn optional_param_with_default<T>(
    request: &ToolRequest,
    param_name: &str,
    default: T,
) -> Result<T, ToolError>
where
    T: DeserializeOwned,
{
    match optional_param(request, param_name)? {
        Some(value) => Ok(value),
        None => Ok(default),
    }
}

/// Extract an optional integer parameter
/// Migrated from Go OptionalIntParam function
pub fn optional_int_param(request: &ToolRequest, param_name: &str) -> Result<Option<i32>, ToolError> {
    match request.get_arguments().get(param_name) {
        Some(value) => {
            // Handle both integer and float JSON numbers
            match value {
                Value::Number(n) => {
                    if let Some(i) = n.as_i64() {
                        Ok(Some(i as i32))
                    } else if let Some(f) = n.as_f64() {
                        Ok(Some(f as i32))
                    } else {
                        Err(ToolError::InvalidArguments {
                            message: format!("Parameter {} is not a valid number", param_name),
                        })
                    }
                }
                _ => Err(ToolError::InvalidArguments {
                    message: format!("Parameter {} is not a number", param_name),
                }),
            }
        }
        None => Ok(None),
    }
}

/// Extract an optional integer parameter with default value
/// Migrated from Go OptionalIntParamWithDefault function
pub fn optional_int_param_with_default(
    request: &ToolRequest,
    param_name: &str,
    default: i32,
) -> Result<i32, ToolError> {
    match optional_int_param(request, param_name)? {
        Some(value) => Ok(if value == 0 { default } else { value }),
        None => Ok(default),
    }
}

/// Extract an optional string array parameter
/// Migrated from Go OptionalStringArrayParam function
pub fn optional_string_array_param(
    request: &ToolRequest,
    param_name: &str,
) -> Result<Vec<String>, ToolError> {
    match request.get_arguments().get(param_name) {
        Some(value) => match value {
            Value::Null => Ok(vec![]),
            Value::Array(arr) => {
                let mut result = Vec::new();
                for item in arr {
                    match item {
                        Value::String(s) => result.push(s.clone()),
                        _ => return Err(ToolError::InvalidArguments {
                            message: format!("Parameter {} contains non-string values", param_name),
                        }),
                    }
                }
                Ok(result)
            }
            _ => Err(ToolError::InvalidArguments {
                message: format!("Parameter {} is not an array", param_name),
            }),
        },
        None => Ok(vec![]),
    }
}

/// Extract an optional array of any values
/// Migrated from Go OptionalAnyArrayParam function
pub fn optional_any_array_param(
    request: &ToolRequest,
    param_name: &str,
) -> Result<Vec<Value>, ToolError> {
    match request.get_arguments().get(param_name) {
        Some(value) => match value {
            Value::Null => Ok(vec![]),
            Value::Array(arr) => Ok(arr.clone()),
            _ => Err(ToolError::InvalidArguments {
                message: format!("Parameter {} is not an array", param_name),
            }),
        },
        None => Ok(vec![]),
    }
}

/// Extract a parameter with flexible JSON handling
/// Migrated from Go ExtractParam function
pub fn extract_param<T>(request: &ToolRequest, param_name: &str) -> Result<Option<T>, ToolError>
where
    T: DeserializeOwned,
{
    match request.get_arguments().get(param_name) {
        Some(value) => {
            let parsed: T = serde_json::from_value(value.clone())
                .map_err(|e| ToolError::InvalidArguments {
                    message: format!("Parameter {} is not of expected type: {}", param_name, e),
                })?;
            Ok(Some(parsed))
        }
        None => Ok(None),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn create_test_request(args: Value) -> ToolRequest {
        let map = args.as_object().unwrap().clone();
        ToolRequest::new(map)
    }

    #[test]
    fn test_required_param() {
        let request = create_test_request(json!({
            "name": "test_value",
            "count": 42
        }));

        let name: String = required_param(&request, "name").unwrap();
        assert_eq!(name, "test_value");

        let count: i32 = required_param(&request, "count").unwrap();
        assert_eq!(count, 42);

        // Test missing parameter
        let result: Result<String, _> = required_param(&request, "missing");
        assert!(result.is_err());
    }

    #[test]
    fn test_optional_param() {
        let request = create_test_request(json!({
            "name": "test_value"
        }));

        let name: Option<String> = optional_param(&request, "name").unwrap();
        assert_eq!(name, Some("test_value".to_string()));

        let missing: Option<String> = optional_param(&request, "missing").unwrap();
        assert_eq!(missing, None);
    }

    #[test]
    fn test_optional_int_param() {
        let request = create_test_request(json!({
            "count": 42,
            "float_val": 3.14
        }));

        let count = optional_int_param(&request, "count").unwrap();
        assert_eq!(count, Some(42));

        let float_val = optional_int_param(&request, "float_val").unwrap();
        assert_eq!(float_val, Some(3));

        let missing = optional_int_param(&request, "missing").unwrap();
        assert_eq!(missing, None);
    }

    #[test]
    fn test_optional_string_array_param() {
        let request = create_test_request(json!({
            "tags": ["tag1", "tag2", "tag3"],
            "empty": []
        }));

        let tags = optional_string_array_param(&request, "tags").unwrap();
        assert_eq!(tags, vec!["tag1", "tag2", "tag3"]);

        let empty = optional_string_array_param(&request, "empty").unwrap();
        assert_eq!(empty, Vec::<String>::new());

        let missing = optional_string_array_param(&request, "missing").unwrap();
        assert_eq!(missing, Vec::<String>::new());
    }
}