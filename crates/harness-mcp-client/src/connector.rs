//! Connector service client

use crate::{client::HarnessClient, error::ClientResult};
use serde::{Deserialize, Serialize};

/// Connector service client
pub struct ConnectorClient {
    client: HarnessClient,
}

/// Connector information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Connector {
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    pub connector_type: String,
    pub project_identifier: Option<String>,
    pub org_identifier: Option<String>,
}

impl ConnectorClient {
    /// Create a new connector client
    pub fn new(client: HarnessClient) -> Self {
        Self { client }
    }

    /// List connectors
    pub async fn list_connectors(
        &self,
        account_id: &str,
        org_id: Option<&str>,
        project_id: Option<&str>,
    ) -> ClientResult<Vec<Connector>> {
        let mut path = format!("ng/api/connectors?accountIdentifier={}", account_id);

        if let Some(org_id) = org_id {
            path.push_str(&format!("&orgIdentifier={}", org_id));
        }

        if let Some(project_id) = project_id {
            path.push_str(&format!("&projectIdentifier={}", project_id));
        }

        let request = self.client.get(&path);
        self.client.execute(request).await
    }

    /// Get connector details
    pub async fn get_connector(
        &self,
        account_id: &str,
        connector_id: &str,
        org_id: Option<&str>,
        project_id: Option<&str>,
    ) -> ClientResult<Connector> {
        let mut path = format!(
            "ng/api/connectors/{}?accountIdentifier={}",
            connector_id, account_id
        );

        if let Some(org_id) = org_id {
            path.push_str(&format!("&orgIdentifier={}", org_id));
        }

        if let Some(project_id) = project_id {
            path.push_str(&format!("&projectIdentifier={}", project_id));
        }

        let request = self.client.get(&path);
        self.client.execute(request).await
    }

    /// List connector catalogue
    pub async fn list_connector_catalogue(
        &self,
        account_id: &str,
    ) -> ClientResult<Vec<serde_json::Value>> {
        let path = format!(
            "ng/api/connectors/catalogue?accountIdentifier={}",
            account_id
        );

        let request = self.client.get(&path);
        self.client.execute(request).await
    }
}
