use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Scope {
    #[serde(rename = "accountIdentifier")]
    pub account_id: String,
    #[serde(rename = "orgIdentifier")]
    pub org_id: String,
    #[serde(rename = "projectIdentifier")]
    pub project_id: String,
}

impl Scope {
    pub fn get_ref(&self) -> String {
        let mut result = Vec::new();
        if !self.account_id.is_empty() {
            result.push(self.account_id.clone());
            if !self.org_id.is_empty() {
                result.push(self.org_id.clone());
                if !self.project_id.is_empty() {
                    result.push(self.project_id.clone());
                }
            }
        }
        result.join("/")
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entity<T> {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub status: String,
    pub data: T,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub correlation_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListOutput<T> {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<ListOutputData<T>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListOutputData<T> {
    #[serde(rename = "totalElements", skip_serializing_if = "Option::is_none")]
    pub total_elements: Option<i32>,
    #[serde(rename = "totalItems", skip_serializing_if = "Option::is_none")]
    pub total_items: Option<i32>,
    #[serde(rename = "totalPages", skip_serializing_if = "Option::is_none")]
    pub total_pages: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<i32>,
    #[serde(rename = "pageSize", skip_serializing_if = "Option::is_none")]
    pub page_size: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<Vec<T>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub number: Option<i32>,
    #[serde(rename = "pageIndex", skip_serializing_if = "Option::is_none")]
    pub page_index: Option<i32>,
    #[serde(rename = "pageItemCount", skip_serializing_if = "Option::is_none")]
    pub page_item_count: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sort: Option<SortInfo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub first: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pageable: Option<PageableInfo>,
    #[serde(rename = "numberOfElements", skip_serializing_if = "Option::is_none")]
    pub number_of_elements: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub empty: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginationOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SortInfo {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub empty: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unsorted: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sorted: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageableInfo {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub offset: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sort: Option<SortInfo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub paged: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unpaged: Option<bool>,
    #[serde(rename = "pageSize", skip_serializing_if = "Option::is_none")]
    pub page_size: Option<i32>,
    #[serde(rename = "pageNumber", skip_serializing_if = "Option::is_none")]
    pub page_number: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitDetails {
    #[serde(rename = "objectId", skip_serializing_if = "Option::is_none")]
    pub object_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub branch: Option<String>,
    #[serde(rename = "repoIdentifier", skip_serializing_if = "Option::is_none")]
    pub repo_identifier: Option<String>,
    #[serde(rename = "rootFolder", skip_serializing_if = "Option::is_none")]
    pub root_folder: Option<String>,
    #[serde(rename = "filePath", skip_serializing_if = "Option::is_none")]
    pub file_path: Option<String>,
    #[serde(rename = "repoName", skip_serializing_if = "Option::is_none")]
    pub repo_name: Option<String>,
    #[serde(rename = "commitId", skip_serializing_if = "Option::is_none")]
    pub commit_id: Option<String>,
    #[serde(rename = "fileUrl", skip_serializing_if = "Option::is_none")]
    pub file_url: Option<String>,
    #[serde(rename = "repoUrl", skip_serializing_if = "Option::is_none")]
    pub repo_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub valid: Option<bool>,
    #[serde(rename = "invalidYaml", skip_serializing_if = "Option::is_none")]
    pub invalid_yaml: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityValidityDetails {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub valid: Option<bool>,
    #[serde(rename = "invalidYaml", skip_serializing_if = "Option::is_none")]
    pub invalid_yaml: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(rename = "userName", skip_serializing_if = "Option::is_none")]
    pub user_name: Option<String>,
    #[serde(rename = "createdAt", skip_serializing_if = "Option::is_none")]
    pub created_at: Option<i64>,
}
