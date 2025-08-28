use std::collections::HashMap;
use std::sync::Arc;

use crate::harness::tools::Tool;

pub struct ToolsetGroup {
    pub name: String,
    pub tools: HashMap<String, Arc<dyn Tool>>,
}

impl ToolsetGroup {
    pub fn new(name: String) -> Self {
        Self {
            name,
            tools: HashMap::new(),
        }
    }

    pub fn add_tool(&mut self, tool: Arc<dyn Tool>) {
        let name = tool.name().to_string();
        self.tools.insert(name, tool);
    }

    pub fn get_tool(&self, name: &str) -> Option<&Arc<dyn Tool>> {
        self.tools.get(name)
    }

    pub fn list_tools(&self) -> Vec<&Arc<dyn Tool>> {
        self.tools.values().collect()
    }
}