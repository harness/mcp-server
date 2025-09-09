use crate::{HarnessClient, Result};
use harness_mcp_dto::Scope;
use serde_json::Value;

#[derive(Clone)]
pub struct ConnectorService {
    client: HarnessClient,
}

impl ConnectorService {
    pub fn new(client: HarnessClient) -> Self {
        Self { client }
    }

    pub async fn list_catalogue(&self, _scope: &Scope) -> Result<Value> {
        let path = "/v1/connectors/catalogue".to_string();
        self.client.get(&path).await
    }

    pub async fn get(&self, scope: &Scope, connector_id: &str) -> Result<Value> {
        let path = format!(
            "/v1/orgs/{}/projects/{}/connectors/{}",
            scope.org_id, scope.project_id, connector_id
        );
        self.client.get(&path).await
    }

    pub async fn list(&self, scope: &Scope, page: Option<u32>, size: Option<u32>) -> Result<Value> {
        let mut path = format!(
            "/v1/orgs/{}/projects/{}/connectors",
            scope.org_id, scope.project_id
        );

        let mut query_params = Vec::new();
        if let Some(page) = page {
            query_params.push(format!("page={}", page));
        }
        if let Some(size) = size {
            query_params.push(format!("size={}", size));
        }

        if !query_params.is_empty() {
            path.push('?');
            path.push_str(&query_params.join("&"));
        }

        self.client.get(&path).await
    }
}
