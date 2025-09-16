pub mod mcp;
pub mod server;
pub mod transport;
pub mod error;

pub use error::{McpError, Result};

/// Version information
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version() {
        assert!(!VERSION.is_empty());
    }
}