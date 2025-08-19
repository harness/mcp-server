use anyhow::Result;
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub account_id: String,
    pub user_id: Option<String>,
    pub org_id: Option<String>,
    pub project_id: Option<String>,
    pub exp: usize,
    pub iat: usize,
}

#[derive(Debug, Clone)]
pub struct JwtValidator {
    secret: String,
    validation: Validation,
}

impl JwtValidator {
    pub fn new(secret: String) -> Self {
        let mut validation = Validation::new(Algorithm::HS256);
        validation.required_spec_claims = HashSet::new();
        validation.validate_exp = true;
        validation.validate_aud = false;
        
        Self {
            secret,
            validation,
        }
    }

    pub fn validate_token(&self, token: &str) -> Result<Claims> {
        let key = DecodingKey::from_secret(self.secret.as_ref());
        let token_data = decode::<Claims>(token, &key, &self.validation)?;
        Ok(token_data.claims)
    }

    pub fn extract_bearer_token(auth_header: &str) -> Option<&str> {
        if auth_header.starts_with("Bearer ") {
            Some(&auth_header[7..])
        } else {
            None
        }
    }
}