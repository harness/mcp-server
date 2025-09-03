use crate::config::Config;
use crate::harness;
use crate::harness::prompts;
use crate::modules;
use std::env;
use std::sync::Once;
use tokio::sync::OnceCell;

// Shared variables and Once instances to ensure one-time execution
static GET_TOKEN_ONCE: Once = Once::new();
static mut TOKEN: Option<String> = None;

static GET_ACCOUNT_ID_ONCE: Once = Once::new();
static mut ACCOUNT_ID: Option<String> = None;

static GET_ORG_ID_ONCE: Once = Once::new();
static mut ORG_ID: Option<String> = None;

static GET_PROJECT_ID_ONCE: Once = Once::new();
static mut PROJECT_ID: Option<String> = None;

static SETUP_CLIENT_ONCE: OnceCell<Result<TestClient, Box<dyn std::error::Error + Send + Sync>>> = OnceCell::const_new();

#[derive(Clone)]
pub struct TestClient {
    // MCP client would go here when available
    // For now, we'll use a placeholder
    pub base_url: String,
    pub token: String,
}

/// Get E2E token, ensures the environment variable is checked only once
pub fn get_e2e_token() -> Result<String, Box<dyn std::error::Error>> {
    unsafe {
        GET_TOKEN_ONCE.call_once(|| {
            TOKEN = env::var("HARNESS_MCP_SERVER_E2E_TOKEN").ok();
        });
        
        TOKEN.clone().ok_or_else(|| {
            "HARNESS_MCP_SERVER_E2E_TOKEN environment variable is not set".into()
        })
    }
}

/// Get E2E account ID, ensures the environment variable is checked only once
pub fn get_e2e_account_id() -> Result<String, Box<dyn std::error::Error>> {
    unsafe {
        GET_ACCOUNT_ID_ONCE.call_once(|| {
            ACCOUNT_ID = env::var("HARNESS_MCP_SERVER_E2E_ACCOUNT_ID").ok();
        });
        
        ACCOUNT_ID.clone().ok_or_else(|| {
            "HARNESS_MCP_SERVER_E2E_ACCOUNT_ID environment variable is not set".into()
        })
    }
}

/// Get E2E org ID, ensures the environment variable is checked only once
pub fn get_e2e_org_id() -> Result<String, Box<dyn std::error::Error>> {
    unsafe {
        GET_ORG_ID_ONCE.call_once(|| {
            ORG_ID = env::var("HARNESS_MCP_SERVER_E2E_ORG_ID").ok();
        });
        
        ORG_ID.clone().ok_or_else(|| {
            "HARNESS_MCP_SERVER_E2E_ORG_ID environment variable is not set".into()
        })
    }
}

/// Get E2E project ID, ensures the environment variable is checked only once
pub fn get_e2e_project_id() -> Result<String, Box<dyn std::error::Error>> {
    unsafe {
        GET_PROJECT_ID_ONCE.call_once(|| {
            PROJECT_ID = env::var("HARNESS_MCP_SERVER_E2E_PROJECT_ID").ok();
        });
        
        PROJECT_ID.clone().ok_or_else(|| {
            "HARNESS_MCP_SERVER_E2E_PROJECT_ID environment variable is not set".into()
        })
    }
}

/// Setup test client, ensures client is created only once
pub async fn setup_test_client() -> Result<TestClient, Box<dyn std::error::Error + Send + Sync>> {
    SETUP_CLIENT_ONCE.get_or_init(|| async {
        let token = get_e2e_token()?;
        
        // Create test client
        let client = TestClient {
            base_url: "https://app.harness.io".to_string(),
            token,
        };
        
        Ok(client)
    }).await.clone()
}

/// Helper function to skip test if environment variables are not set
pub fn skip_if_no_e2e_env() -> Result<(), Box<dyn std::error::Error>> {
    get_e2e_token()?;
    get_e2e_account_id()?;
    get_e2e_org_id()?;
    get_e2e_project_id()?;
    Ok(())
}

/// Create test config for E2E tests
pub fn create_test_config() -> Result<Config, Box<dyn std::error::Error>> {
    let token = get_e2e_token()?;
    let account_id = get_e2e_account_id()?;
    let org_id = get_e2e_org_id()?;
    let project_id = get_e2e_project_id()?;
    
    Ok(Config {
        harness_platform_api_key: Some(token),
        harness_platform_account_id: Some(account_id),
        harness_platform_organization_id: Some(org_id),
        harness_platform_project_id: Some(project_id),
        internal: false,
        ..Default::default()
    })
}

/// Helper to run command and capture output
pub async fn run_command(cmd: &str, args: &[&str]) -> Result<String, Box<dyn std::error::Error>> {
    let output = tokio::process::Command::new(cmd)
        .args(args)
        .output()
        .await?;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Command failed: {}", stderr).into());
    }
    
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

/// Helper to check if binary exists
pub async fn check_binary_exists(binary_name: &str) -> bool {
    tokio::process::Command::new("which")
        .arg(binary_name)
        .output()
        .await
        .map(|output| output.status.success())
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio;

    #[tokio::test]
    async fn test_get_e2e_token() {
        // This test will only pass if the environment variable is set
        if env::var("HARNESS_MCP_SERVER_E2E_TOKEN").is_ok() {
            let token = get_e2e_token().expect("Should get token");
            assert!(!token.is_empty());
        }
    }

    #[tokio::test]
    async fn test_skip_if_no_e2e_env() {
        // This test checks if all required environment variables are set
        // It will skip if they're not available
        match skip_if_no_e2e_env() {
            Ok(_) => {
                // All environment variables are set
                println!("E2E environment variables are available");
            }
            Err(_) => {
                // Some environment variables are missing
                println!("E2E environment variables are not set, skipping E2E tests");
            }
        }
    }

    #[tokio::test]
    async fn test_create_test_config() {
        if skip_if_no_e2e_env().is_ok() {
            let config = create_test_config().expect("Should create config");
            assert!(config.harness_platform_api_key.is_some());
            assert!(config.harness_platform_account_id.is_some());
            assert!(config.harness_platform_organization_id.is_some());
            assert!(config.harness_platform_project_id.is_some());
        }
    }

    #[tokio::test]
    async fn test_setup_test_client() {
        if skip_if_no_e2e_env().is_ok() {
            let client = setup_test_client().await.expect("Should setup client");
            assert!(!client.token.is_empty());
            assert!(!client.base_url.is_empty());
        }
    }

    #[tokio::test]
    async fn test_run_command() {
        let output = run_command("echo", &["hello", "world"])
            .await
            .expect("Should run echo command");
        assert!(output.contains("hello world"));
    }

    #[tokio::test]
    async fn test_check_binary_exists() {
        // Test with a binary that should exist on most systems
        let exists = check_binary_exists("echo").await;
        assert!(exists);
        
        // Test with a binary that shouldn't exist
        let not_exists = check_binary_exists("nonexistent_binary_12345").await;
        assert!(!not_exists);
    }
}