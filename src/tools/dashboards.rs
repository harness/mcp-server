use anyhow::Result;
use async_trait::async_trait;
use serde_json::{json, Value};
use std::collections::HashMap;

use crate::config::Config;
use crate::tools::Tool;
use crate::common::Scope;

// Helper functions for parameter extraction
fn get_required_param<T>(arguments: &Value, key: &str) -> Result<T>
where
    T: serde::de::DeserializeOwned,
{
    arguments
        .get(key)
        .ok_or_else(|| anyhow::anyhow!("Missing required parameter: {}", key))?
        .clone()
        .try_into()
        .map_err(|_| anyhow::anyhow!("Invalid type for parameter: {}", key))
}

fn get_optional_param<T>(arguments: &Value, key: &str) -> Result<Option<T>>
where
    T: serde::de::DeserializeOwned,
{
    match arguments.get(key) {
        Some(value) => Ok(Some(
            value
                .clone()
                .try_into()
                .map_err(|_| anyhow::anyhow!("Invalid type for parameter: {}", key))?,
        )),
        None => Ok(None),
    }
}

fn get_scope_from_request(arguments: &Value, config: &Config) -> Result<Scope> {
    let account_id = config.account_id.clone().unwrap_or_default();
    let org_id = get_optional_param::<String>(arguments, "org_id")?
        .or_else(|| config.default_org_id.clone());
    let project_id = get_optional_param::<String>(arguments, "project_id")?
        .or_else(|| config.default_project_id.clone());

    // For dashboards, project_id is optional (can be account or org level)
    if let (Some(org_id), Some(project_id)) = (org_id.clone(), project_id) {
        Ok(Scope::project_level(account_id, org_id, project_id))
    } else if let Some(org_id) = org_id {
        Ok(Scope::org_level(account_id, org_id))
    } else {
        Ok(Scope::account_level(account_id))
    }
}

fn get_dashboard_pagination(arguments: &Value) -> (u64, u64) {
    let page = arguments
        .get("page")
        .and_then(|v| v.as_u64())
        .unwrap_or(1); // Dashboard pagination starts at 1
    let size = arguments
        .get("size")
        .and_then(|v| v.as_u64())
        .unwrap_or(100); // Dashboard default page size is 100
    (page, size)
}

// List Dashboards Tool
pub struct ListDashboardsTool;

impl ListDashboardsTool {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl Tool for ListDashboardsTool {
    fn name(&self) -> &str {
        "list_dashboards"
    }

    fn description(&self) -> &str {
        "Lists all available Harness dashboards"
    }

    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "org_id": {
                    "type": "string",
                    "description": "Organization ID (optional)"
                },
                "project_id": {
                    "type": "string",
                    "description": "Project ID (optional)"
                },
                "page": {
                    "type": "integer",
                    "description": "Page number for pagination - page 1 is the first page",
                    "minimum": 1,
                    "default": 1
                },
                "size": {
                    "type": "integer",
                    "description": "Number of items per page",
                    "default": 100,
                    "maximum": 100
                }
            }
        })
    }

    async fn execute(&self, arguments: &Value, config: &Config) -> Result<Value> {
        let _scope = get_scope_from_request(arguments, config)?;
        let (page, size) = get_dashboard_pagination(arguments);

        // Define friendly names for categories to improve readability
        let category_names: HashMap<&str, &str> = [
            ("CD", "Continuous Delivery"),
            ("CE", "Cloud Cost Management (CCM)"),
            ("CET", "Customer Experience"),
            ("CF", "Cloud Formation"),
            ("CHAOS", "Chaos Engineering"),
            ("CI", "Continuous Integration"),
            ("CI_TI", "Test Intelligence"),
            ("DBOPS", "Database Operations"),
            ("IACM", "Infrastructure as Code"),
            ("IDP", "Internal Developer Platform"),
            ("SSCA", "Software Supply Chain"),
            ("STO", "Security Testing"),
            ("SRM", "Service Reliability Management"),
            ("custom", "Custom Dashboards"),
            ("UNIVERSAL", "Universal Dashboards"),
        ].iter().cloned().collect();

        // TODO: Implement actual API call to Harness
        // For now, return mock data organized by categories
        let mock_dashboards = vec![
            json!({
                "id": "cd_overview_123",
                "title": "CD Overview Dashboard",
                "models": ["CD"]
            }),
            json!({
                "id": "ce_cost_456",
                "title": "Cloud Cost Analysis",
                "models": ["CE"]
            }),
            json!({
                "id": "ci_builds_789",
                "title": "CI Build Metrics",
                "models": ["CI"]
            }),
            json!({
                "id": "security_overview_101",
                "title": "Security Overview",
                "models": ["STO", "SSCA"]
            }),
            json!({
                "id": "custom_dashboard_202",
                "title": "Custom Business Metrics",
                "models": []
            })
        ];

        // Process result, organizing dashboards by model categories
        let mut formatted_categories: HashMap<String, Vec<String>> = HashMap::new();
        let mut active_category_order: Vec<String> = Vec::new();
        let mut category_dashboards: HashMap<String, Vec<Value>> = HashMap::new();

        for dashboard in &mock_dashboards {
            let id = dashboard["id"].as_str().unwrap_or("");
            let title = dashboard["title"].as_str().unwrap_or("");
            let display_format = format!("ID: {} - {}", id, title);

            let models = dashboard["models"].as_array().unwrap_or(&vec![]);
            
            if models.is_empty() {
                // If no models, categorize as "custom"
                let category = "custom".to_string();
                if !formatted_categories.contains_key(&category) {
                    formatted_categories.insert(category.clone(), Vec::new());
                    active_category_order.push(category.clone());
                    category_dashboards.insert(category.clone(), Vec::new());
                }
                formatted_categories.get_mut(&category).unwrap().push(display_format);
                category_dashboards.get_mut(&category).unwrap().push(dashboard.clone());
            } else {
                // Add to each model category
                for model in models {
                    if let Some(model_str) = model.as_str() {
                        let category = model_str.to_string();
                        if !formatted_categories.contains_key(&category) {
                            formatted_categories.insert(category.clone(), Vec::new());
                            active_category_order.push(category.clone());
                            category_dashboards.insert(category.clone(), Vec::new());
                        }
                        formatted_categories.get_mut(&category).unwrap().push(display_format.clone());
                        category_dashboards.get_mut(&category).unwrap().push(dashboard.clone());
                    }
                }
            }
        }

        // Create a well-structured response object designed for chat display
        let response_obj = json!({
            "display_format": "list", // Hint to LLM to use list format instead of tables
            "total_count": mock_dashboards.len(),
            "categories": formatted_categories,
            "category_names": category_names,
            "category_order": active_category_order,
            "raw_data": category_dashboards,
            "format_example": "Category Name:\n- ID: 123 - Dashboard Name\n- ID: 456 - Another Dashboard",
            "pagination": {
                "page": page,
                "size": size
            }
        });

        Ok(json!(serde_json::to_string(&response_obj)?))
    }
}

// Get Dashboard Data Tool
pub struct GetDashboardDataTool;

impl GetDashboardDataTool {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl Tool for GetDashboardDataTool {
    fn name(&self) -> &str {
        "get_dashboard_data"
    }

    fn description(&self) -> &str {
        "Retrieves the data from a specific Harness dashboard"
    }

    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "dashboard_id": {
                    "type": "string",
                    "description": "The ID of the dashboard to retrieve data from"
                },
                "reporting_timeframe": {
                    "type": "integer",
                    "description": "Reporting timeframe in days",
                    "default": 30,
                    "minimum": 1,
                    "maximum": 365
                },
                "org_id": {
                    "type": "string",
                    "description": "Organization ID (optional)"
                },
                "project_id": {
                    "type": "string",
                    "description": "Project ID (optional)"
                }
            },
            "required": ["dashboard_id"]
        })
    }

    async fn execute(&self, arguments: &Value, config: &Config) -> Result<Value> {
        let dashboard_id: String = get_required_param(arguments, "dashboard_id")?;
        let reporting_timeframe: u64 = get_optional_param(arguments, "reporting_timeframe")?.unwrap_or(30);
        let _scope = get_scope_from_request(arguments, config)?;

        // TODO: Implement actual API call to Harness
        // For now, return mock dashboard data
        let dashboard_data = json!({
            "dashboard_id": dashboard_id,
            "title": format!("Dashboard {}", dashboard_id),
            "timeframe_days": reporting_timeframe,
            "widgets": [
                {
                    "id": "widget_1",
                    "type": "metric",
                    "title": "Total Deployments",
                    "value": 142,
                    "trend": "+12%"
                },
                {
                    "id": "widget_2", 
                    "type": "chart",
                    "title": "Success Rate",
                    "data": {
                        "current_period": 94.5,
                        "previous_period": 91.2,
                        "unit": "percentage"
                    }
                },
                {
                    "id": "widget_3",
                    "type": "list",
                    "title": "Recent Deployments",
                    "items": [
                        {
                            "name": "frontend-app",
                            "status": "success",
                            "timestamp": "2024-01-15T10:30:00Z"
                        },
                        {
                            "name": "backend-api",
                            "status": "success", 
                            "timestamp": "2024-01-15T09:15:00Z"
                        }
                    ]
                }
            ],
            "last_updated": "2024-01-15T11:00:00Z"
        });

        let result = json!({
            "dashboard_id": dashboard_id,
            "data": dashboard_data
        });

        Ok(json!(serde_json::to_string(&result)?))
    }
}