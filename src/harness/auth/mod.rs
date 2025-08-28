pub mod api_key;
pub mod jwt;
pub mod session;

pub use api_key::*;
pub use jwt::*;
pub use session::*;

use anyhow::Result;

pub trait Authenticator {
    async fn authenticate(&self, token: &str) -> Result<AuthSession>;
}

#[derive(Debug, Clone)]
pub struct AuthSession {
    pub account_id: String,
    pub user_id: Option<String>,
    pub org_id: Option<String>,
    pub project_id: Option<String>,
}