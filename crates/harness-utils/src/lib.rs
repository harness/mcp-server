pub mod http;
pub mod json;
pub mod time;

/// Common utility functions
pub fn format_error(error: &dyn std::error::Error) -> String {
    format!("Error: {}", error)
}

/// Validate required field
pub fn validate_required_field<T>(field: &Option<T>, field_name: &str) -> Result<&T, String> {
    field.as_ref().ok_or_else(|| format!("Missing required field: {}", field_name))
}