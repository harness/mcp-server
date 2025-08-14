use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Custom event constants
pub const CUSTOM_EVENT_URI: &str = "harness:custom-event";
pub const CUSTOM_EVENT_MIME_TYPE: &str = "application/vnd.harness.custom-event+json";

/// Custom event sent back to a client as embedded resource
/// Migrated from Go event.CustomEvent struct
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomEvent {
    #[serde(rename = "type")]
    pub event_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub continue_processing: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub display_order: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<Value>,
}

impl CustomEvent {
    /// Create a new custom event
    pub fn new(event_type: String, content: Option<Value>) -> Self {
        Self {
            event_type,
            continue_processing: Some(true),
            display_order: None,
            content,
        }
    }

    /// Set whether the event allows continuation
    pub fn with_continue(mut self, continue_flag: bool) -> Self {
        self.continue_processing = Some(continue_flag);
        self
    }

    /// Set the display order for the event
    pub fn with_display_order(mut self, order: i32) -> Self {
        self.display_order = Some(order);
        self
    }

    /// Convert to JSON string for MCP resource
    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string(self)
    }
}

/// Table column representation
/// Migrated from Go types.TableColumn struct
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableColumn {
    pub key: String,
    pub label: String,
}

/// Table row representation (map of string to any value)
/// Migrated from Go types.TableRow type alias
pub type TableRow = serde_json::Map<String, Value>;

/// Table data structure
/// Migrated from Go types.TableData struct
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableData {
    pub columns: Vec<TableColumn>,
    pub rows: Vec<TableRow>,
}

/// Table wrapper for events
/// Migrated from Go types.TableWrapper struct
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableWrapper {
    pub table: TableData,
}

/// Create a table event
/// Migrated from Go types.NewTableEvent function
pub fn new_table_event(table_data: TableData, display_order: Option<i32>) -> CustomEvent {
    let wrapper = TableWrapper { table: table_data };
    let content = serde_json::to_value(wrapper).ok();
    
    let mut event = CustomEvent::new("table".to_string(), content);
    if let Some(order) = display_order {
        event = event.with_display_order(order);
    }
    event
}

/// Action display order constant
pub const ACTION_DISPLAY_ORDER: i32 = 100;

/// Action wrapper for prompt events
/// Migrated from Go types.ActionWrapper struct
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionWrapper {
    pub prompts: Vec<String>,
}

/// Create an action event with prompts
/// Migrated from Go types.NewActionEvent function
pub fn new_action_event(actions: Vec<String>, display_order: Option<i32>) -> CustomEvent {
    let wrapper = ActionWrapper { prompts: actions };
    let content = serde_json::to_value(wrapper).ok();
    
    let order = display_order.unwrap_or(ACTION_DISPLAY_ORDER);
    CustomEvent::new("prompt".to_string(), content)
        .with_display_order(order)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_custom_event_creation() {
        let event = CustomEvent::new("test".to_string(), Some(json!({"key": "value"})));
        assert_eq!(event.event_type, "test");
        assert_eq!(event.continue_processing, Some(true));
        assert!(event.content.is_some());
    }

    #[test]
    fn test_table_event() {
        let columns = vec![
            TableColumn { key: "id".to_string(), label: "ID".to_string() },
            TableColumn { key: "name".to_string(), label: "Name".to_string() },
        ];
        
        let mut row = serde_json::Map::new();
        row.insert("id".to_string(), json!("1"));
        row.insert("name".to_string(), json!("Test"));
        
        let table_data = TableData {
            columns,
            rows: vec![row],
        };
        
        let event = new_table_event(table_data, Some(50));
        assert_eq!(event.event_type, "table");
        assert_eq!(event.display_order, Some(50));
    }

    #[test]
    fn test_action_event() {
        let actions = vec!["Action 1".to_string(), "Action 2".to_string()];
        let event = new_action_event(actions, None);
        
        assert_eq!(event.event_type, "prompt");
        assert_eq!(event.display_order, Some(ACTION_DISPLAY_ORDER));
    }
}