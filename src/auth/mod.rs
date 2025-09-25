use crate::error::{HarnessError, Result};
use serde::{Deserialize, Serialize};

/// Authentication provider trait
pub trait AuthProvider {
    fn get_headers(&self) -> Vec<(String, String)>;
}

/// API key authentication
#[derive(Debug, Clone)]
pub struct ApiKeyAuth {
    pub api_key: String,
    pub account_id: String,
}

impl ApiKeyAuth {
    pub fn new(api_key: String, account_id: String) -> Self {
        Self { api_key, account_id }
    }
}

impl AuthProvider for ApiKeyAuth {
    fn get_headers(&self) -> Vec<(String, String)> {
        vec![
            ("x-api-key".to_string(), self.api_key.clone()),
            ("Harness-Account".to_string(), self.account_id.clone()),
        ]
    }
}

/// Bearer token authentication
#[derive(Debug, Clone)]
pub struct BearerTokenAuth {
    pub token: String,
    pub account_id: String,
}

impl BearerTokenAuth {
    pub fn new(token: String, account_id: String) -> Self {
        Self { token, account_id }
    }
}

impl AuthProvider for BearerTokenAuth {
    fn get_headers(&self) -> Vec<(String, String)> {
        vec![
            ("Authorization".to_string(), format!("Bearer {}", self.token)),
            ("Harness-Account".to_string(), self.account_id.clone()),
        ]
    }
}

/// Authentication session information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthSession {
    pub account_id: String,
    pub user_id: Option<String>,
    pub org_id: Option<String>,
    pub project_id: Option<String>,
}

/// Extract account ID from API key
pub fn extract_account_id_from_api_key(api_key: &str) -> Result<String> {
    // API key format: pat.ACCOUNT_ID.TOKEN_ID.<>
    let parts: Vec<&str> = api_key.split('.').collect();
    if parts.len() < 2 {
        return Err(HarnessError::InvalidApiKey);
    }
    Ok(parts[1].to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_api_key_auth_get_headers() {
        let auth = ApiKeyAuth::new("test-api-key-123".to_string(), "test-account".to_string());
        let headers = auth.get_headers();
        
        assert_eq!(headers.len(), 2);
        assert_eq!(headers[0], ("x-api-key".to_string(), "test-api-key-123".to_string()));
        assert_eq!(headers[1], ("Harness-Account".to_string(), "test-account".to_string()));
    }

    #[test]
    fn test_api_key_auth_empty_values() {
        let auth = ApiKeyAuth::new("".to_string(), "".to_string());
        let headers = auth.get_headers();
        
        assert_eq!(headers.len(), 2);
        assert_eq!(headers[0], ("x-api-key".to_string(), "".to_string()));
        assert_eq!(headers[1], ("Harness-Account".to_string(), "".to_string()));
    }

    #[test]
    fn test_bearer_token_auth_get_headers() {
        let auth = BearerTokenAuth::new("test-token-123".to_string(), "test-account".to_string());
        let headers = auth.get_headers();
        
        assert_eq!(headers.len(), 2);
        assert_eq!(headers[0], ("Authorization".to_string(), "Bearer test-token-123".to_string()));
        assert_eq!(headers[1], ("Harness-Account".to_string(), "test-account".to_string()));
    }

    #[test]
    fn test_extract_account_id_from_api_key_valid() {
        let api_key = "pat.test_account_id.token_id.suffix";
        let result = extract_account_id_from_api_key(api_key).unwrap();
        assert_eq!(result, "test_account_id");
    }

    #[test]
    fn test_extract_account_id_from_api_key_minimal() {
        let api_key = "pat.account123";
        let result = extract_account_id_from_api_key(api_key).unwrap();
        assert_eq!(result, "account123");
    }

    #[test]
    fn test_extract_account_id_from_api_key_invalid() {
        let api_key = "invalid-format";
        let result = extract_account_id_from_api_key(api_key);
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), HarnessError::InvalidApiKey));
    }

    #[test]
    fn test_extract_account_id_from_api_key_empty() {
        let api_key = "";
        let result = extract_account_id_from_api_key(api_key);
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), HarnessError::InvalidApiKey));
    }
}