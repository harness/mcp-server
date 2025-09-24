//! Dashboard service client

use crate::{client::HarnessClient, error::ClientResult};
use serde::{Deserialize, Serialize};

/// Dashboard service client
pub struct DashboardClient {
    client: HarnessClient,
}

/// Dashboard information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Dashboard {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub tags: Option<Vec<String>>,
}

/// Dashboard data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardData {
    pub dashboard_id: String,
    pub data: serde_json::Value,
}

impl DashboardClient {
    /// Create a new dashboard client
    pub fn new(client: HarnessClient) -> Self {
        Self { client }
    }

    /// List dashboards
    pub async fn list_dashboards(&self, account_id: &str) -> ClientResult<Vec<Dashboard>> {
        let path = format!("dashboard/api/dashboards?accountIdentifier={}", account_id);

        let request = self.client.get(&path);
        self.client.execute(request).await
    }

    /// Get dashboard data
    pub async fn get_dashboard_data(
        &self,
        account_id: &str,
        dashboard_id: &str,
    ) -> ClientResult<DashboardData> {
        let path = format!(
            "dashboard/api/dashboards/{}/data?accountIdentifier={}",
            dashboard_id, account_id
        );

        let request = self.client.get(&path);
        self.client.execute(request).await
    }
}
