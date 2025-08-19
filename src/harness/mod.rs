use anyhow::Result;
use crate::config::Config;

pub mod auth;
pub mod tools;
pub mod dto;
pub mod event;
pub mod prompts;
pub mod errors;
pub mod client;
pub mod traits;
pub mod implementations;

pub use errors::{HarnessError, HarnessResult};
pub use client::{HarnessClient, PipelineClient, ConnectorClient, RequestOptions};
pub use traits::*;
pub use implementations::*;

#[derive(Clone)]
pub struct HarnessServer {
    config: Config,
    client: HarnessClient,
}

impl HarnessServer {
    pub async fn new(config: &Config) -> Result<Self> {
        let client = HarnessClient::new(config)?;
        
        Ok(Self {
            config: config.clone(),
            client,
        })
    }
    
    pub fn client(&self) -> &HarnessClient {
        &self.client
    }
    
    pub fn config(&self) -> &Config {
        &self.config
    }
}