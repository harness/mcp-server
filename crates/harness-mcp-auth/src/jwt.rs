use crate::provider::Result;
use reqwest::RequestBuilder;

#[derive(Clone)]
pub struct JwtAuth {
    bearer_token: String,
}

impl JwtAuth {
    pub fn new(bearer_token: String) -> Self {
        Self { bearer_token }
    }

    pub async fn add_headers(&self, request: RequestBuilder) -> Result<RequestBuilder> {
        Ok(request.header("Authorization", format!("Bearer {}", self.bearer_token)))
    }
}
