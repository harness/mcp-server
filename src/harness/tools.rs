use crate::types::HarnessError;
use serde_json::Value;

/// Tool parameter extraction utilities
pub mod params {
    use super::*;

    /// Extract a required parameter from tool request
    pub fn required_param<T>(request: &Value, key: &str) -> Result<T, HarnessError>
    where
        T: serde::de::DeserializeOwned,
    {
        let value = request
            .get("arguments")
            .and_then(|args| args.get(key))
            .ok_or_else(|| HarnessError::Validation(format!("Required parameter '{}' is missing", key)))?;

        serde_json::from_value(value.clone())
            .map_err(|e| HarnessError::Validation(format!("Invalid parameter '{}': {}", key, e)))
    }

    /// Extract an optional parameter from tool request
    pub fn optional_param<T>(request: &Value, key: &str) -> Result<Option<T>, HarnessError>
    where
        T: serde::de::DeserializeOwned,
    {
        match request.get("arguments").and_then(|args| args.get(key)) {
            Some(value) if !value.is_null() => {
                let parsed = serde_json::from_value(value.clone())
                    .map_err(|e| HarnessError::Validation(format!("Invalid parameter '{}': {}", key, e)))?;
                Ok(Some(parsed))
            }
            _ => Ok(None),
        }
    }
}

/// Pagination utilities for tools
pub mod pagination {
    use super::*;
    use crate::types::PaginationOptions;

    /// Extract pagination parameters from tool request
    pub fn fetch_pagination(request: &Value) -> Result<PaginationOptions, HarnessError> {
        let page = params::optional_param::<u32>(request, "page")?;
        let size = params::optional_param::<u32>(request, "size")?;

        Ok(PaginationOptions { page, size })
    }
}

/// Tool result builders
pub mod results {
    use super::*;

    /// Create a successful text result
    pub fn text_result(content: String) -> Value {
        serde_json::json!({
            "content": [{
                "type": "text",
                "text": content
            }]
        })
    }

    /// Create an error result
    pub fn error_result(message: String) -> Value {
        serde_json::json!({
            "content": [{
                "type": "text",
                "text": format!("Error: {}", message)
            }],
            "isError": true
        })
    }

    /// Create a JSON result
    pub fn json_result(data: &Value) -> Result<Value, HarnessError> {
        let json_string = serde_json::to_string_pretty(data)
            .map_err(|e| HarnessError::Json(e))?;
        
        Ok(text_result(json_string))
    }
}

/// Tool schema builders
pub mod schema {
    use super::*;

    /// Create a string parameter schema
    pub fn string_param(name: &str, description: &str, required: bool) -> Value {
        let mut param = serde_json::json!({
            "type": "string",
            "description": description
        });

        if required {
            param["required"] = Value::Bool(true);
        }

        serde_json::json!({
            name: param
        })
    }

    /// Create an integer parameter schema
    pub fn int_param(name: &str, description: &str, required: bool) -> Value {
        let mut param = serde_json::json!({
            "type": "integer",
            "description": description
        });

        if required {
            param["required"] = Value::Bool(true);
        }

        serde_json::json!({
            name: param
        })
    }

    /// Create a boolean parameter schema
    pub fn bool_param(name: &str, description: &str, required: bool) -> Value {
        let mut param = serde_json::json!({
            "type": "boolean",
            "description": description
        });

        if required {
            param["required"] = Value::Bool(true);
        }

        serde_json::json!({
            name: param
        })
    }
}