//! Harness API client library
//! 
//! This crate provides a Rust client for interacting with Harness APIs,
//! including authentication, retry logic, and service-specific clients.

pub mod auth;
pub mod client;
pub mod error;
pub mod services;
pub mod types;

pub use auth::{ApiKeyAuth, BearerTokenAuth, JwtAuth};
pub use client::{HarnessClient, HarnessClientBuilder};
pub use error::{HarnessError, Result};
pub use services::{PipelineService, ConnectorService};

/// Default Harness API base URL
pub const DEFAULT_BASE_URL: &str = "https://app.harness.io";

/// Default request timeout in seconds
pub const DEFAULT_TIMEOUT_SECS: u64 = 30;

/// Default retry attempts
pub const DEFAULT_RETRY_ATTEMPTS: usize = 3;