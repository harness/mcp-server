use anyhow::Result;
use serde::{Deserialize, Serialize};
use super::jwt::{JwtValidator, Claims};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Principal {
    pub account_id: String,
    pub user_id: Option<String>,
    pub org_id: Option<String>,
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthSession {
    pub principal: Principal,
    pub token: String,
    pub expires_at: Option<chrono::DateTime<chrono::Utc>>,
}

impl AuthSession {
    pub fn from_claims(claims: Claims, token: String) -> Self {
        let expires_at = chrono::DateTime::from_timestamp(claims.exp as i64, 0);
        
        Self {
            principal: Principal {
                account_id: claims.account_id,
                user_id: claims.user_id,
                org_id: claims.org_id,
                project_id: claims.project_id,
            },
            token,
            expires_at,
        }
    }

    pub fn is_expired(&self) -> bool {
        if let Some(expires_at) = self.expires_at {
            chrono::Utc::now() > expires_at
        } else {
            false
        }
    }
}

pub async fn authenticate_session(bearer_token: &str, mcp_secret: &str) -> Result<AuthSession> {
    let validator = JwtValidator::new(mcp_secret.to_string());
    
    // Extract token from Bearer header if needed
    let token = if bearer_token.starts_with("Bearer ") {
        &bearer_token[7..]
    } else {
        bearer_token
    };

    let claims = validator.validate_token(token)?;
    
    Ok(AuthSession::from_claims(claims, token.to_string()))
}