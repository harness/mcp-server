use crate::config::Config;
use crate::types::{HarnessError, Scope};
use serde_json::Value;

/// Fetch scope information from request parameters and config
pub fn fetch_scope(
    config: &Config,
    request_params: &Value,
    require_project: bool,
) -> Result<Scope, HarnessError> {
    // Get account ID from config
    let account_id = config
        .account_id
        .as_ref()
        .ok_or_else(|| HarnessError::Config("Account ID not configured".to_string()))?
        .clone();

    let mut scope = Scope::new(account_id);

    // Try to get org ID from request params, fall back to config default
    if let Some(org_id) = extract_string_param(request_params, "org_id")
        .or_else(|| config.default_org_id.clone())
    {
        scope = scope.with_org(org_id);
    }

    // Try to get project ID from request params, fall back to config default
    if let Some(project_id) = extract_string_param(request_params, "project_id")
        .or_else(|| config.default_project_id.clone())
    {
        scope = scope.with_project(project_id);
    } else if require_project {
        return Err(HarnessError::Validation(
            "Project ID is required but not provided".to_string(),
        ));
    }

    Ok(scope)
}

/// Extract a string parameter from request parameters
pub fn extract_string_param(params: &Value, key: &str) -> Option<String> {
    params
        .get(key)
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

/// Extract an optional string parameter from request parameters
pub fn extract_optional_string_param(params: &Value, key: &str) -> Result<Option<String>, HarnessError> {
    match params.get(key) {
        Some(Value::String(s)) => Ok(Some(s.clone())),
        Some(Value::Null) => Ok(None),
        Some(_) => Err(HarnessError::Validation(format!(
            "Parameter '{}' must be a string",
            key
        ))),
        None => Ok(None),
    }
}

/// Extract a required string parameter from request parameters
pub fn extract_required_string_param(params: &Value, key: &str) -> Result<String, HarnessError> {
    extract_string_param(params, key).ok_or_else(|| {
        HarnessError::Validation(format!("Required parameter '{}' is missing", key))
    })
}

/// Extract an integer parameter from request parameters
pub fn extract_int_param(params: &Value, key: &str) -> Option<i64> {
    params.get(key).and_then(|v| v.as_i64())
}

/// Extract an optional integer parameter from request parameters
pub fn extract_optional_int_param(params: &Value, key: &str) -> Result<Option<i64>, HarnessError> {
    match params.get(key) {
        Some(Value::Number(n)) => Ok(n.as_i64()),
        Some(Value::Null) => Ok(None),
        Some(_) => Err(HarnessError::Validation(format!(
            "Parameter '{}' must be a number",
            key
        ))),
        None => Ok(None),
    }
}

/// Extract pagination parameters from request
pub fn extract_pagination_params(params: &Value) -> Result<(Option<u32>, Option<u32>), HarnessError> {
    let page = extract_optional_int_param(params, "page")?
        .map(|p| p as u32)
        .or(Some(0));
    
    let size = extract_optional_int_param(params, "size")?
        .map(|s| s as u32)
        .or(Some(50));

    Ok((page, size))
}

/// Validate that a string is not empty
pub fn validate_non_empty_string(value: &str, field_name: &str) -> Result<(), HarnessError> {
    if value.trim().is_empty() {
        return Err(HarnessError::Validation(format!(
            "{} cannot be empty",
            field_name
        )));
    }
    Ok(())
}

/// Build query parameters for scope
pub fn build_scope_query_params(scope: &Scope) -> Vec<(String, String)> {
    let mut params = vec![("accountIdentifier".to_string(), scope.account_id.clone())];
    
    if let Some(org_id) = &scope.org_id {
        params.push(("orgIdentifier".to_string(), org_id.clone()));
    }
    
    if let Some(project_id) = &scope.project_id {
        params.push(("projectIdentifier".to_string(), project_id.clone()));
    }
    
    params
}