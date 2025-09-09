use crate::{HarnessClient, Result};
use harness_mcp_dto::{Environment, EnvironmentListOptions, Scope};
use serde_json::Value;

#[derive(Clone)]
pub struct EnvironmentService {
    client: HarnessClient,
}

impl EnvironmentService {
    pub fn new(client: HarnessClient) -> Self {
        Self { client }
    }

    pub async fn get(&self, scope: &Scope, environment_id: &str) -> Result<Environment> {
        let path = format!(
            "/v1/orgs/{}/projects/{}/environments/{}",
            scope.org_id, scope.project_id, environment_id
        );
        self.client.get(&path).await
    }

    pub async fn list(
        &self,
        scope: &Scope,
        options: Option<EnvironmentListOptions>,
    ) -> Result<Value> {
        let mut path = format!(
            "/v1/orgs/{}/projects/{}/environments",
            scope.org_id, scope.project_id
        );

        if let Some(opts) = options {
            let mut query_params = Vec::new();

            if let Some(page) = opts.pagination.page {
                query_params.push(format!("page={}", page));
            }
            if let Some(size) = opts.pagination.size {
                query_params.push(format!("size={}", size));
            }
            if let Some(search_term) = opts.search_term {
                query_params.push(format!("searchTerm={}", search_term));
            }
            if let Some(env_types) = opts.env_types {
                for env_type in env_types {
                    query_params.push(format!("envTypes={}", env_type));
                }
            }

            if !query_params.is_empty() {
                path.push('?');
                path.push_str(&query_params.join("&"));
            }
        }

        self.client.get(&path).await
    }
}
