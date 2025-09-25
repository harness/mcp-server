//! Service management client implementation

use crate::client::Client;
use crate::dto::{ServiceListOptions, ServiceListResponse, ServiceResponse, Scope};
use crate::error::{Error, Result};

/// Service management client
#[derive(Clone)]
pub struct ServiceManagementService {
    client: Client,
}

impl ServiceManagementService {
    /// Create a new service management client
    pub fn new(client: Client) -> Self {
        Self { client }
    }

    /// Get a specific service
    pub async fn get(&self, scope: &Scope, service_id: &str) -> Result<ServiceResponse> {
        let path = format!(
            "/ng/api/servicesV2/{}/orgs/{}/projects/{}",
            service_id,
            scope.org_id.as_deref().unwrap_or_default(),
            scope.project_id.as_deref().unwrap_or_default()
        );
        self.client.get(&path).await
    }

    /// List services
    pub async fn list(
        &self,
        scope: &Scope,
        options: &ServiceListOptions,
    ) -> Result<ServiceListResponse> {
        let mut path = format!(
            "/ng/api/servicesV2/orgs/{}/projects/{}",
            scope.org_id.as_deref().unwrap_or_default(),
            scope.project_id.as_deref().unwrap_or_default()
        );

        // Add query parameters
        let mut query_params = Vec::new();
        if let Some(page) = options.pagination.page {
            query_params.push(format!("page={}", page));
        }
        if let Some(size) = options.pagination.size {
            query_params.push(format!("size={}", size));
        }
        if let Some(ref search_term) = options.search_term {
            query_params.push(format!("searchTerm={}", urlencoding::encode(search_term)));
        }
        if let Some(ref sort) = options.sort {
            query_params.push(format!("sort={}", urlencoding::encode(sort)));
        }
        if let Some(ref order) = options.order {
            query_params.push(format!("order={}", urlencoding::encode(order)));
        }

        if !query_params.is_empty() {
            path.push('?');
            path.push_str(&query_params.join("&"));
        }

        self.client.get(&path).await
    }
}