use crate::provider::{AuthError, Result};
use reqwest::RequestBuilder;

#[derive(Clone)]
pub struct ApiKeyAuth {
    api_key: String,
    account_id: String,
}

impl ApiKeyAuth {
    pub fn new(api_key: String) -> Result<Self> {
        // Extract account ID from API key
        // API key format: pat.ACCOUNT_ID.TOKEN_ID.<>
        let parts: Vec<&str> = api_key.split('.').collect();
        if parts.len() < 2 {
            return Err(AuthError::InvalidApiKey);
        }

        let account_id = parts[1].to_string();

        Ok(Self {
            api_key,
            account_id,
        })
    }

    pub async fn add_headers(&self, request: RequestBuilder) -> Result<RequestBuilder> {
        Ok(request
            .header("x-api-key", &self.api_key)
            .header("Harness-Account", &self.account_id))
    }

    pub fn account_id(&self) -> &str {
        &self.account_id
    }
}
