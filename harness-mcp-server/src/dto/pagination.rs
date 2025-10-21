use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PaginationOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page: Option<i32>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<i32>,
}

impl Default for PaginationOptions {
    fn default() -> Self {
        Self {
            page: Some(0),
            size: Some(20),
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ListOutput<T> {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    
    pub data: ListOutputData<T>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
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
    
    pub content: Vec<T>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub number: Option<i32>,
    
    #[serde(rename = "pageIndex", skip_serializing_if = "Option::is_none")]
    pub page_index: Option<i32>,
    
    #[serde(rename = "pageItemCount", skip_serializing_if = "Option::is_none")]
    pub page_item_count: Option<i32>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub first: Option<bool>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last: Option<bool>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub empty: Option<bool>,
    
    #[serde(rename = "numberOfElements", skip_serializing_if = "Option::is_none")]
    pub number_of_elements: Option<i32>,
}