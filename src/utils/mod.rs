use serde_json::Value;
use std::collections::HashMap;

pub fn create_json_schema_object(properties: HashMap<String, Value>, required: Vec<String>) -> Value {
    serde_json::json!({
        "type": "object",
        "properties": properties,
        "required": required
    })
}

pub fn create_string_property(description: &str) -> Value {
    serde_json::json!({
        "type": "string",
        "description": description
    })
}

pub fn create_boolean_property(description: &str) -> Value {
    serde_json::json!({
        "type": "boolean",
        "description": description
    })
}

pub fn create_integer_property(description: &str) -> Value {
    serde_json::json!({
        "type": "integer",
        "description": description
    })
}

pub fn create_array_property(description: &str, items: Value) -> Value {
    serde_json::json!({
        "type": "array",
        "description": description,
        "items": items
    })
}