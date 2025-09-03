use crate::toolsets::ToolsetGroup;
use crate::types::HarnessError;
use async_trait::async_trait;

/// Module trait defines the contract that all modules must implement
/// This is the Rust equivalent of the Go Module interface
#[async_trait]
pub trait Module: Send + Sync {
    /// Returns the identifier for this module
    fn id(&self) -> &str;
    
    /// Returns the name of module
    fn name(&self) -> &str;
    
    /// Returns the names of toolsets provided by this module
    fn toolsets(&self) -> Vec<String>;
    
    /// Registers all toolsets in this module with the toolset group
    /// It creates necessary clients and adds tools to the toolset group
    async fn register_toolsets(&self) -> Result<(), HarnessError>;
    
    /// Enables all toolsets in this module in the toolset group
    /// This is called after register_toolsets to activate the toolsets
    async fn enable_toolsets(&self, tsg: &mut ToolsetGroup) -> Result<(), HarnessError>;
    
    /// Indicates if this module should be enabled by default
    /// when no specific modules are requested
    fn is_default(&self) -> bool;
}

/// Tool handler trait for MCP tools
/// This defines the interface for handling MCP tool requests
#[async_trait]
pub trait ToolHandler: Send + Sync {
    /// Handle a tool request and return the result
    async fn handle(&self, request: &serde_json::Value) -> Result<serde_json::Value, HarnessError>;
    
    /// Get the tool name
    fn name(&self) -> &str;
    
    /// Get the tool description
    fn description(&self) -> &str;
    
    /// Get the tool schema for parameters
    fn schema(&self) -> serde_json::Value;
}

/// Service client trait for Harness API services
/// This provides a common interface for all service clients
#[async_trait]
pub trait ServiceClient: Send + Sync {
    /// Get the base URL for this service
    fn base_url(&self) -> &str;
    
    /// Get the service name
    fn service_name(&self) -> &str;
    
    /// Perform health check on the service
    async fn health_check(&self) -> Result<bool, HarnessError>;
}

/// Authentication provider trait
/// This defines the interface for different authentication methods
#[async_trait]
pub trait AuthProvider: Send + Sync {
    /// Get authentication headers for requests
    async fn get_auth_headers(&self) -> Result<Vec<(String, String)>, HarnessError>;
    
    /// Validate the authentication credentials
    async fn validate(&self) -> Result<bool, HarnessError>;
    
    /// Get the account ID associated with this authentication
    fn account_id(&self) -> Option<&str>;
}

/// Scope provider trait for handling Harness resource scoping
pub trait ScopeProvider {
    /// Get the account ID
    fn account_id(&self) -> &str;
    
    /// Get the organization ID if available
    fn org_id(&self) -> Option<&str>;
    
    /// Get the project ID if available
    fn project_id(&self) -> Option<&str>;
    
    /// Build query parameters for API requests
    fn build_query_params(&self) -> Vec<(String, String)> {
        let mut params = vec![("accountIdentifier".to_string(), self.account_id().to_string())];
        
        if let Some(org_id) = self.org_id() {
            params.push(("orgIdentifier".to_string(), org_id.to_string()));
        }
        
        if let Some(project_id) = self.project_id() {
            params.push(("projectIdentifier".to_string(), project_id.to_string()));
        }
        
        params
    }
}

/// Paginated response trait for handling API pagination
pub trait Paginated {
    type Item;
    
    /// Get the items in this page
    fn items(&self) -> &[Self::Item];
    
    /// Get the current page number
    fn page(&self) -> u32;
    
    /// Get the page size
    fn size(&self) -> u32;
    
    /// Get the total number of items
    fn total(&self) -> u64;
    
    /// Get the total number of pages
    fn total_pages(&self) -> u32;
    
    /// Check if there are more pages
    fn has_next_page(&self) -> bool {
        self.page() < self.total_pages().saturating_sub(1)
    }
    
    /// Check if this is the first page
    fn is_first_page(&self) -> bool {
        self.page() == 0
    }
    
    /// Check if this is the last page
    fn is_last_page(&self) -> bool {
        !self.has_next_page()
    }
}

/// Serializable trait for objects that can be converted to/from JSON
pub trait Serializable: serde::Serialize + for<'de> serde::Deserialize<'de> {
    /// Convert to JSON string
    fn to_json(&self) -> Result<String, HarnessError> {
        serde_json::to_string(self).map_err(HarnessError::Json)
    }
    
    /// Convert to JSON value
    fn to_json_value(&self) -> Result<serde_json::Value, HarnessError> {
        serde_json::to_value(self).map_err(HarnessError::Json)
    }
    
    /// Create from JSON string
    fn from_json(json: &str) -> Result<Self, HarnessError>
    where
        Self: Sized,
    {
        serde_json::from_str(json).map_err(HarnessError::Json)
    }
    
    /// Create from JSON value
    fn from_json_value(value: serde_json::Value) -> Result<Self, HarnessError>
    where
        Self: Sized,
    {
        serde_json::from_value(value).map_err(HarnessError::Json)
    }
}

/// Identifiable trait for objects that have an identifier
pub trait Identifiable {
    /// Get the unique identifier for this object
    fn identifier(&self) -> &str;
    
    /// Get the human-readable name for this object
    fn name(&self) -> &str;
}

/// Taggable trait for objects that support tags
pub trait Taggable {
    /// Get the tags for this object
    fn tags(&self) -> Option<&std::collections::HashMap<String, String>>;
    
    /// Check if this object has a specific tag
    fn has_tag(&self, key: &str) -> bool {
        self.tags()
            .map(|tags| tags.contains_key(key))
            .unwrap_or(false)
    }
    
    /// Get the value of a specific tag
    fn get_tag(&self, key: &str) -> Option<&str> {
        self.tags()
            .and_then(|tags| tags.get(key))
            .map(|s| s.as_str())
    }
}

/// Timestamped trait for objects that have creation/modification timestamps
pub trait Timestamped {
    /// Get the creation timestamp
    fn created_at(&self) -> Option<i64>;
    
    /// Get the last modification timestamp
    fn last_modified_at(&self) -> Option<i64>;
    
    /// Format creation timestamp as human-readable string
    fn created_at_formatted(&self) -> Option<String> {
        self.created_at().map(format_timestamp)
    }
    
    /// Format last modification timestamp as human-readable string
    fn last_modified_at_formatted(&self) -> Option<String> {
        self.last_modified_at().map(format_timestamp)
    }
}

/// Versioned trait for objects that have version information
pub trait Versioned {
    /// Get the version number
    fn version(&self) -> Option<i64>;
    
    /// Check if this is a specific version
    fn is_version(&self, version: i64) -> bool {
        self.version() == Some(version)
    }
}

/// Helper function to format timestamps
fn format_timestamp(timestamp: i64) -> String {
    use chrono::{DateTime, Utc};
    
    if let Some(dt) = DateTime::from_timestamp(timestamp / 1000, ((timestamp % 1000) * 1_000_000) as u32) {
        dt.format("%Y-%m-%d %H:%M:%S UTC").to_string()
    } else {
        timestamp.to_string()
    }
}

/// Helper function for module toolset enabling
/// This is the Rust equivalent of the Go ModuleEnableToolsets function
pub async fn module_enable_toolsets(
    module: &dyn Module,
    tsg: &mut ToolsetGroup,
) -> Result<(), HarnessError> {
    // Only enable toolsets that exist in the toolset group
    let existing_toolsets: Vec<String> = module
        .toolsets()
        .into_iter()
        .filter(|toolset_name| tsg.toolsets.contains_key(toolset_name))
        .collect();

    // Enable only the existing toolsets
    if existing_toolsets.is_empty() {
        return Ok(());
    }

    // Enable the toolsets
    tsg.enable_toolsets(&existing_toolsets)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    struct TestObject {
        id: String,
        name: String,
        tags: Option<HashMap<String, String>>,
        created_at: Option<i64>,
        version: Option<i64>,
    }

    impl Identifiable for TestObject {
        fn identifier(&self) -> &str {
            &self.id
        }

        fn name(&self) -> &str {
            &self.name
        }
    }

    impl Taggable for TestObject {
        fn tags(&self) -> Option<&HashMap<String, String>> {
            self.tags.as_ref()
        }
    }

    impl Timestamped for TestObject {
        fn created_at(&self) -> Option<i64> {
            self.created_at
        }

        fn last_modified_at(&self) -> Option<i64> {
            None
        }
    }

    impl Versioned for TestObject {
        fn version(&self) -> Option<i64> {
            self.version
        }
    }

    #[test]
    fn test_identifiable() {
        let obj = TestObject {
            id: "test-id".to_string(),
            name: "Test Object".to_string(),
            tags: None,
            created_at: None,
            version: None,
        };

        assert_eq!(obj.identifier(), "test-id");
        assert_eq!(obj.name(), "Test Object");
    }

    #[test]
    fn test_taggable() {
        let mut tags = HashMap::new();
        tags.insert("env".to_string(), "test".to_string());
        tags.insert("team".to_string(), "platform".to_string());

        let obj = TestObject {
            id: "test-id".to_string(),
            name: "Test Object".to_string(),
            tags: Some(tags),
            created_at: None,
            version: None,
        };

        assert!(obj.has_tag("env"));
        assert!(obj.has_tag("team"));
        assert!(!obj.has_tag("nonexistent"));
        assert_eq!(obj.get_tag("env"), Some("test"));
        assert_eq!(obj.get_tag("team"), Some("platform"));
        assert_eq!(obj.get_tag("nonexistent"), None);
    }

    #[test]
    fn test_timestamped() {
        let obj = TestObject {
            id: "test-id".to_string(),
            name: "Test Object".to_string(),
            tags: None,
            created_at: Some(1640995200000), // 2022-01-01 00:00:00 UTC
            version: None,
        };

        assert_eq!(obj.created_at(), Some(1640995200000));
        assert!(obj.created_at_formatted().unwrap().contains("2022-01-01"));
    }

    #[test]
    fn test_versioned() {
        let obj = TestObject {
            id: "test-id".to_string(),
            name: "Test Object".to_string(),
            tags: None,
            created_at: None,
            version: Some(42),
        };

        assert_eq!(obj.version(), Some(42));
        assert!(obj.is_version(42));
        assert!(!obj.is_version(43));
    }
}