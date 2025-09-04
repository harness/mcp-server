// Middleware for Harness API requests

use anyhow::Result;
use tracing::{info, warn};

use crate::config::Config;

pub struct AccountMiddleware {
    config: Config,
}

impl AccountMiddleware {
    pub fn new(config: Config) -> Self {
        Self { config }
    }

    pub fn validate_account_access(&self, account_id: &str) -> Result<()> {
        if account_id != self.config.account_id {
            warn!(
                "Account ID mismatch: expected {}, got {}",
                self.config.account_id, account_id
            );
            return Err(anyhow::anyhow!("Account ID mismatch"));
        }
        
        info!("Account access validated for: {}", account_id);
        Ok(())
    }

    pub fn get_account_id(&self) -> &str {
        &self.config.account_id
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    fn create_test_config() -> Config {
        Config {
            base_url: "https://app.harness.io".to_string(),
            api_key: "pat.test_account.test_token.xyz".to_string(),
            account_id: "test_account".to_string(),
            org_id: Some("test_org".to_string()),
            project_id: Some("test_project".to_string()),
            toolsets: HashSet::new(),
            read_only: false,
        }
    }

    #[test]
    fn test_account_middleware_valid() {
        let config = create_test_config();
        let middleware = AccountMiddleware::new(config);
        let result = middleware.validate_account_access("test_account");
        assert!(result.is_ok());
    }

    #[test]
    fn test_account_middleware_invalid() {
        let config = create_test_config();
        let middleware = AccountMiddleware::new(config);
        let result = middleware.validate_account_access("wrong_account");
        assert!(result.is_err());
    }
}