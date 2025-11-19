#[cfg(test)]
mod tests {
    use crate::client::{HarnessClient, Scope};

    #[test]
    fn test_harness_client_creation() {
        let client = HarnessClient::new("https://app.harness.io".to_string());
        assert_eq!(client.base_url, "https://app.harness.io");
        assert!(client.api_key.is_none());
        assert!(client.bearer_token.is_none());
    }

    #[test]
    fn test_harness_client_with_api_key() {
        let client = HarnessClient::new("https://app.harness.io".to_string())
            .with_api_key("test_key".to_string());
        assert_eq!(client.api_key, Some("test_key".to_string()));
    }

    #[test]
    fn test_harness_client_with_bearer_token() {
        let client = HarnessClient::new("https://app.harness.io".to_string())
            .with_bearer_token("test_token".to_string());
        assert_eq!(client.bearer_token, Some("test_token".to_string()));
    }

    #[test]
    fn test_scope_creation() {
        let scope = Scope::new("account123".to_string());
        assert_eq!(scope.account_id, "account123");
        assert!(scope.org_id.is_none());
        assert!(scope.project_id.is_none());
    }

    #[test]
    fn test_scope_with_org_and_project() {
        let scope = Scope::new("account123".to_string())
            .with_org("org456".to_string())
            .with_project("project789".to_string());
        
        assert_eq!(scope.account_id, "account123");
        assert_eq!(scope.org_id, Some("org456".to_string()));
        assert_eq!(scope.project_id, Some("project789".to_string()));
    }
}