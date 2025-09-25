//! Service factory for creating Harness API clients

use harness_mcp_auth::AuthProvider;
use harness_mcp_client::{Client, services::{PipelineService, ConnectorService, ServiceManagementService}};
use harness_mcp_core::error::{Error, Result};
use std::sync::Arc;
use url::Url;

/// Factory for creating Harness service clients
pub struct ServiceFactory {
    client: Client,
}

impl ServiceFactory {
    /// Create a new service factory
    pub fn new(
        base_url: Url,
        auth_provider: Arc<dyn AuthProvider>,
        timeout: Option<std::time::Duration>,
    ) -> Result<Self> {
        let client = Client::new(base_url, auth_provider, timeout)
            .map_err(|e| Error::Generic(format!("Failed to create client: {}", e)))?;
        
        Ok(Self { client })
    }

    /// Create a pipeline service
    pub fn pipeline_service(&self) -> PipelineService {
        PipelineService::new(self.client.clone())
    }

    /// Create a connector service
    pub fn connector_service(&self) -> ConnectorService {
        ConnectorService::new(self.client.clone())
    }

    /// Create a service management service
    pub fn service_management_service(&self) -> ServiceManagementService {
        ServiceManagementService::new(self.client.clone())
    }
}