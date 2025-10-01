use anyhow::Result;
use serde_json::Value;

/// MCP transport trait for different communication methods
pub trait McpTransport: Send + Sync {
    async fn send(&self, message: Value) -> Result<()>;
    async fn receive(&self) -> Result<Value>;
}

/// Stdio transport implementation
pub struct StdioTransport;

impl StdioTransport {
    pub fn new() -> Self {
        Self
    }
}

impl McpTransport for StdioTransport {
    async fn send(&self, message: Value) -> Result<()> {
        use tokio::io::{AsyncWriteExt, stdout};
        
        let mut stdout = stdout();
        let message_str = serde_json::to_string(&message)?;
        stdout.write_all(message_str.as_bytes()).await?;
        stdout.write_all(b"\n").await?;
        stdout.flush().await?;
        
        Ok(())
    }
    
    async fn receive(&self) -> Result<Value> {
        use tokio::io::{AsyncBufReadExt, BufReader, stdin};
        
        let stdin = stdin();
        let mut reader = BufReader::new(stdin);
        let mut line = String::new();
        
        reader.read_line(&mut line).await?;
        let trimmed = line.trim();
        
        if trimmed.is_empty() {
            return Err(anyhow::anyhow!("Empty input received"));
        }
        
        let value: Value = serde_json::from_str(trimmed)?;
        Ok(value)
    }
}