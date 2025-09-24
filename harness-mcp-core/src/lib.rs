pub mod config;
pub mod error;
pub mod logging;
pub mod mcp;
pub mod protocol;
pub mod server;
pub mod tools;
pub mod transport;
pub mod types;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lib_modules_exist() {
        // Basic smoke test to ensure all modules compile
        assert!(true);
    }
}