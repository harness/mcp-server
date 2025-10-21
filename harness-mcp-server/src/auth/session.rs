use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AuthSession {
    pub principal: Principal,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Principal {
    #[serde(rename = "accountID")]
    pub account_id: String,
}