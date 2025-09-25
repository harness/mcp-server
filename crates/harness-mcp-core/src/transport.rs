//! Transport layer implementations for MCP

use crate::error::{Error, Result};
use crate::types::{JsonRpcRequest, JsonRpcResponse};
use async_trait::async_trait;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader, Stdin, Stdout};
use tokio::sync::mpsc;

/// Transport trait for MCP communication
#[async_trait]
pub trait Transport: Send + Sync {
    async fn send(&mut self, response: JsonRpcResponse) -> Result<()>;
    async fn receive(&mut self) -> Result<JsonRpcRequest>;
}

/// STDIO transport implementation
pub struct StdioTransport {
    stdin: BufReader<Stdin>,
    stdout: Stdout,
}

impl StdioTransport {
    pub fn new() -> Self {
        Self {
            stdin: BufReader::new(tokio::io::stdin()),
            stdout: tokio::io::stdout(),
        }
    }
}

impl Default for StdioTransport {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Transport for StdioTransport {
    async fn send(&mut self, response: JsonRpcResponse) -> Result<()> {
        let json = serde_json::to_string(&response)
            .map_err(|e| Error::Serialization(e))?;
        
        self.stdout.write_all(json.as_bytes()).await
            .map_err(|e| Error::Io(e))?;
        self.stdout.write_all(b"\n").await
            .map_err(|e| Error::Io(e))?;
        self.stdout.flush().await
            .map_err(|e| Error::Io(e))?;
        
        Ok(())
    }

    async fn receive(&mut self) -> Result<JsonRpcRequest> {
        let mut line = String::new();
        self.stdin.read_line(&mut line).await
            .map_err(|e| Error::Io(e))?;
        
        if line.trim().is_empty() {
            return Err(Error::Transport("Empty line received".to_string()));
        }
        
        let request: JsonRpcRequest = serde_json::from_str(&line)
            .map_err(|e| Error::Serialization(e))?;
        
        Ok(request)
    }
}

/// HTTP transport implementation using channels
pub struct HttpTransport {
    request_receiver: mpsc::UnboundedReceiver<JsonRpcRequest>,
    response_sender: mpsc::UnboundedSender<JsonRpcResponse>,
}

impl HttpTransport {
    pub fn new() -> (Self, mpsc::UnboundedSender<JsonRpcRequest>, mpsc::UnboundedReceiver<JsonRpcResponse>) {
        let (request_sender, request_receiver) = mpsc::unbounded_channel();
        let (response_sender, response_receiver) = mpsc::unbounded_channel();
        
        let transport = Self {
            request_receiver,
            response_sender,
        };
        
        (transport, request_sender, response_receiver)
    }
}

#[async_trait]
impl Transport for HttpTransport {
    async fn send(&mut self, response: JsonRpcResponse) -> Result<()> {
        self.response_sender.send(response)
            .map_err(|_| Error::Transport("Failed to send response".to_string()))?;
        Ok(())
    }

    async fn receive(&mut self) -> Result<JsonRpcRequest> {
        self.request_receiver.recv().await
            .ok_or_else(|| Error::Transport("Request channel closed".to_string()))
    }
}

/// WebSocket transport implementation (placeholder)
pub struct WebSocketTransport {
    // TODO: Implement WebSocket transport
}

impl WebSocketTransport {
    pub fn new() -> Self {
        Self {}
    }
}

impl Default for WebSocketTransport {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Transport for WebSocketTransport {
    async fn send(&mut self, _response: JsonRpcResponse) -> Result<()> {
        // TODO: Implement WebSocket send
        Err(Error::Transport("WebSocket transport not implemented".to_string()))
    }

    async fn receive(&mut self) -> Result<JsonRpcRequest> {
        // TODO: Implement WebSocket receive
        Err(Error::Transport("WebSocket transport not implemented".to_string()))
    }
}