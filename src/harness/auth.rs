// Authentication utilities for Harness API

use anyhow::Result;
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
    pub iat: usize,
    // Add other JWT claims as needed
}

pub fn validate_jwt_token(token: &str, secret: &[u8]) -> Result<Claims> {
    let validation = Validation::new(Algorithm::HS256);
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret),
        &validation,
    )?;
    
    Ok(token_data.claims)
}

// TODO: Implement other authentication utilities as needed