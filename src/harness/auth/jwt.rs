use anyhow::Result;
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use serde::{Deserialize, Serialize};
use super::{Authenticator, AuthSession};

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub account_id: String,
    pub user_id: Option<String>,
    pub org_id: Option<String>,
    pub project_id: Option<String>,
    pub exp: usize,
}

pub struct JwtAuthenticator {
    secret: String,
}

impl JwtAuthenticator {
    pub fn new(secret: String) -> Self {
        Self { secret }
    }

    pub fn decode_token(&self, token: &str) -> Result<Claims> {
        let key = DecodingKey::from_secret(self.secret.as_ref());
        let validation = Validation::new(Algorithm::HS256);
        
        let token_data = decode::<Claims>(token, &key, &validation)?;
        Ok(token_data.claims)
    }
}

impl Authenticator for JwtAuthenticator {
    async fn authenticate(&self, token: &str) -> Result<AuthSession> {
        let claims = self.decode_token(token)?;
        
        Ok(AuthSession {
            account_id: claims.account_id,
            user_id: claims.user_id,
            org_id: claims.org_id,
            project_id: claims.project_id,
        })
    }
}