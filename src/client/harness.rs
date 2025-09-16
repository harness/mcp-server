use crate::client::HttpClient;
use crate::error::Result;
use serde::{Deserialize, Serialize};

// TODO: Implement Harness-specific client wrappers

#[derive(Clone)]
pub struct PipelineService {
    client: HttpClient,
}

impl PipelineService {
    pub fn new(client: HttpClient) -> Self {
        Self { client }
    }

    // TODO: Implement pipeline-specific methods
}

#[derive(Clone)]
pub struct ConnectorService {
    client: HttpClient,
}

impl ConnectorService {
    pub fn new(client: HttpClient) -> Self {
        Self { client }
    }

    // TODO: Implement connector-specific methods
}

// TODO: Add other service clients as needed