use crate::{AuthError, AuthSession, Principal};

/// Extract account ID from Harness API key
/// API key format: pat.ACCOUNT_ID.TOKEN_ID.<>
/// Migrated from Go extractAccountIDFromAPIKey function
pub fn extract_account_id_from_api_key(api_key: &str) -> Result<String, AuthError> {
    let parts: Vec<&str> = api_key.split('.').collect();
    if parts.len() < 2 {
        return Err(AuthError::InvalidApiKey);
    }
    Ok(parts[1].to_string())
}

/// Create authentication session from API key
pub fn authenticate_with_api_key(
    api_key: &str,
    default_org_id: Option<String>,
    default_project_id: Option<String>,
) -> Result<AuthSession, AuthError> {
    let account_id = extract_account_id_from_api_key(api_key)?;

    let principal = Principal {
        id: None,
        uid: "api_key_user".to_string(), // API keys don't have specific user IDs
        email: None,
        principal_type: "API_KEY".to_string(),
        display_name: Some("API Key User".to_string()),
        account_id,
        org_id: default_org_id,
        project_id: default_project_id,
    };

    Ok(AuthSession {
        principal,
        token: api_key.to_string(),
        expires_at: None, // API keys don't expire
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_account_id_from_api_key() {
        let api_key = "pat.account123.token456.signature789";
        let result = extract_account_id_from_api_key(api_key).unwrap();
        assert_eq!(result, "account123");
    }

    #[test]
    fn test_extract_account_id_invalid_format() {
        let api_key = "invalid_key";
        let result = extract_account_id_from_api_key(api_key);
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), AuthError::InvalidApiKey));
    }

    #[test]
    fn test_authenticate_with_api_key() {
        let api_key = "pat.account123.token456.signature789";
        let session = authenticate_with_api_key(
            api_key,
            Some("org123".to_string()),
            Some("project456".to_string()),
        ).unwrap();

        assert_eq!(session.principal.account_id, "account123");
        assert_eq!(session.principal.org_id, Some("org123".to_string()));
        assert_eq!(session.principal.project_id, Some("project456".to_string()));
        assert_eq!(session.principal.principal_type, "API_KEY");
        assert_eq!(session.token, api_key);
        assert!(session.expires_at.is_none());
    }
}