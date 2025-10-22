//! Environment variable handling

use std::env;
use std::collections::HashMap;

/// Environment variable manager
pub struct Environment {
    prefix: String,
    vars: HashMap<String, String>,
}

impl Environment {
    /// Create a new environment manager with prefix
    pub fn new(prefix: &str) -> Self {
        let mut vars = HashMap::new();
        
        // Load all environment variables with the prefix
        for (key, value) in env::vars() {
            if key.starts_with(&format!("{}_", prefix.to_uppercase())) {
                // Convert HARNESS_API_KEY to api_key
                let config_key = key
                    .strip_prefix(&format!("{}_", prefix.to_uppercase()))
                    .unwrap()
                    .to_lowercase();
                vars.insert(config_key, value);
            }
        }
        
        Self {
            prefix: prefix.to_string(),
            vars,
        }
    }

    /// Get an environment variable
    pub fn get(&self, key: &str) -> Option<&String> {
        self.vars.get(key)
    }

    /// Get an environment variable with default
    pub fn get_or(&self, key: &str, default: &str) -> String {
        self.vars.get(key).cloned().unwrap_or_else(|| default.to_string())
    }

    /// Get all variables
    pub fn all(&self) -> &HashMap<String, String> {
        &self.vars
    }

    /// Check if a variable exists
    pub fn has(&self, key: &str) -> bool {
        self.vars.contains_key(key)
    }
}

/// Load environment variables from .env file
pub fn load_dotenv() -> Result<(), Box<dyn std::error::Error>> {
    match dotenvy::dotenv() {
        Ok(_) => {
            tracing::debug!("Loaded .env file");
            Ok(())
        }
        Err(dotenvy::Error::Io(e)) if e.kind() == std::io::ErrorKind::NotFound => {
            tracing::debug!("No .env file found");
            Ok(())
        }
        Err(e) => {
            tracing::warn!("Failed to load .env file: {}", e);
            Err(Box::new(e))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[test]
    fn test_environment_loading() {
        env::set_var("HARNESS_TEST_VAR", "test_value");
        
        let env = Environment::new("harness");
        assert_eq!(env.get("test_var"), Some(&"test_value".to_string()));
        assert!(env.has("test_var"));
        assert!(!env.has("nonexistent"));
        
        env::remove_var("HARNESS_TEST_VAR");
    }
}