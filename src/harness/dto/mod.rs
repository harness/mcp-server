//! Data Transfer Objects for Harness API

use serde::{Deserialize, Serialize};

/// License information for account
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicenseInfo {
    pub account_id: String,
    pub module_licenses: std::collections::HashMap<String, bool>,
    pub is_valid: bool,
}

/// License status enum
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LicenseStatus {
    Active,
    Inactive,
    Expired,
}

impl std::fmt::Display for LicenseStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            LicenseStatus::Active => write!(f, "ACTIVE"),
            LicenseStatus::Inactive => write!(f, "INACTIVE"),
            LicenseStatus::Expired => write!(f, "EXPIRED"),
        }
    }
}

/// Account license response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountLicenseResponse {
    pub status: String,
    pub data: Option<AccountLicenseData>,
}

/// Account license data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountLicenseData {
    pub account_id: String,
    pub all_module_licenses: Option<std::collections::HashMap<String, Vec<ModuleLicense>>>,
}

/// Module license information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModuleLicense {
    pub status: String,
    pub module_type: String,
}