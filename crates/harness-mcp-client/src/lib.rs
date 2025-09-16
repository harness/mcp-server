pub mod client;
pub mod dto;
pub mod error;
pub mod services;

pub use client::{Client, ClientBuilder};
pub use dto::*;
pub use error::{ClientError, Result as ClientResult, ErrorContext, ContextualError, RetryConfig};

/// Re-export common types
pub use harness_mcp_auth::{AuthProvider, Result as AuthResult};

#[cfg(test)]
mod tests {
    #[test]
    fn it_works() {
        let result = 2 + 2;
        assert_eq!(result, 4);
    }
}