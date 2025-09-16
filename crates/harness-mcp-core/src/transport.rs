use crate::error::{McpError, Result};
use crate::mcp::McpMessage;
use async_trait::async_trait;
use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::post,
    Router,
};
use serde_json::Value;
use std::io::{BufRead, BufReader, Read, Write};
use std::sync::Arc;
use tokio::sync::mpsc;
use tower_http::cors::CorsLayer;
use tracing::{debug, error, info};

/// Transport trait for different communication methods
#[async_trait]
pub trait Transport: Send + Sync {
    /// Get the name of this transport
    fn name() -> &'static str
    where
        Self: Sized;

    /// Receive a message from the client
    async fn receive_message(&mut self) -> Result<McpMessage>;

    /// Send a response to the client
    async fn send_response(&mut self, response: Value) -> Result<()>;
}

/// Stdio transport implementation
pub struct StdioTransport<R, W> {
    reader: BufReader<R>,
    writer: W,
}

impl<R: Read, W: Write> StdioTransport<R, W> {
    /// Create a new stdio transport
    pub fn new(reader: R, writer: W) -> Self {
        Self {
            reader: BufReader::new(reader),
            writer,
        }
    }
}

#[async_trait]
impl<R: Read + Send, W: Write + Send> Transport for StdioTransport<R, W> {
    fn name() -> &'static str {
        "stdio"
    }

    async fn receive_message(&mut self) -> Result<McpMessage> {
        let mut line = String::new();
        match self.reader.read_line(&mut line) {
            Ok(0) => Err(McpError::transport("EOF reached")),
            Ok(_) => {
                debug!("Received raw message: {}", line.trim());
                serde_json::from_str(&line.trim())
                    .map_err(|e| McpError::transport(format!("Failed to parse JSON: {}", e)))
            }
            Err(e) => Err(McpError::transport(format!("Failed to read line: {}", e))),
        }
    }

    async fn send_response(&mut self, response: Value) -> Result<()> {
        let response_str = serde_json::to_string(&response)
            .map_err(|e| McpError::transport(format!("Failed to serialize response: {}", e)))?;

        debug!("Sending response: {}", response_str);

        writeln!(self.writer, "{}", response_str)
            .map_err(|e| McpError::transport(format!("Failed to write response: {}", e)))?;

        self.writer
            .flush()
            .map_err(|e| McpError::transport(format!("Failed to flush writer: {}", e)))?;

        Ok(())
    }
}

/// HTTP transport implementation
pub struct HttpTransport {
    port: u16,
    path: String,
    receiver: Option<mpsc::Receiver<McpMessage>>,
    sender: Option<mpsc::Sender<Value>>,
}

impl HttpTransport {
    /// Create a new HTTP transport
    pub fn new(port: u16, path: String) -> Self {
        Self {
            port,
            path,
            receiver: None,
            sender: None,
        }
    }

    /// Start the HTTP server
    async fn start_server(&mut self) -> Result<()> {
        let (msg_tx, msg_rx) = mpsc::channel::<McpMessage>(100);
        let (resp_tx, resp_rx) = mpsc::channel::<Value>(100);

        self.receiver = Some(msg_rx);
        self.sender = Some(resp_tx);

        let app_state = Arc::new(HttpTransportState {
            message_sender: msg_tx,
            response_receiver: tokio::sync::Mutex::new(resp_rx),
        });

        let app = Router::new()
            .route(&self.path, post(handle_mcp_request))
            .layer(CorsLayer::permissive())
            .with_state(app_state);

        let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", self.port))
            .await
            .map_err(|e| McpError::transport(format!("Failed to bind to port {}: {}", self.port, e)))?;

        info!("HTTP server listening on port {} at path {}", self.port, self.path);

        tokio::spawn(async move {
            if let Err(e) = axum::serve(listener, app).await {
                error!("HTTP server error: {}", e);
            }
        });

        Ok(())
    }
}

#[async_trait]
impl Transport for HttpTransport {
    fn name() -> &'static str {
        "http"
    }

    async fn receive_message(&mut self) -> Result<McpMessage> {
        if self.receiver.is_none() {
            self.start_server().await?;
        }

        if let Some(receiver) = &mut self.receiver {
            receiver
                .recv()
                .await
                .ok_or_else(|| McpError::transport("Message channel closed"))
        } else {
            Err(McpError::transport("Receiver not initialized"))
        }
    }

    async fn send_response(&mut self, response: Value) -> Result<()> {
        if let Some(sender) = &self.sender {
            sender
                .send(response)
                .await
                .map_err(|e| McpError::transport(format!("Failed to send response: {}", e)))
        } else {
            Err(McpError::transport("Sender not initialized"))
        }
    }
}

/// State for HTTP transport
struct HttpTransportState {
    message_sender: mpsc::Sender<McpMessage>,
    response_receiver: tokio::sync::Mutex<mpsc::Receiver<Value>>,
}

/// Handle MCP request over HTTP
async fn handle_mcp_request(
    State(state): State<Arc<HttpTransportState>>,
    Json(message): Json<McpMessage>,
) -> Result<Json<Value>, StatusCode> {
    debug!("Received HTTP MCP request");

    // Send the message to the server
    if let Err(e) = state.message_sender.send(message).await {
        error!("Failed to send message to server: {}", e);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    // Wait for the response
    let mut receiver = state.response_receiver.lock().await;
    match receiver.recv().await {
        Some(response) => Ok(Json(response)),
        None => {
            error!("Response channel closed");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    #[tokio::test]
    async fn test_stdio_transport_creation() {
        let input = Cursor::new(b"");
        let output = Vec::new();
        let transport = StdioTransport::new(input, output);
        assert_eq!(StdioTransport::<Cursor<&[u8]>, Vec<u8>>::name(), "stdio");
    }

    #[tokio::test]
    async fn test_http_transport_creation() {
        let transport = HttpTransport::new(8080, "/mcp".to_string());
        assert_eq!(HttpTransport::name(), "http");
    }

    #[tokio::test]
    async fn test_stdio_send_response() {
        let input = Cursor::new(b"");
        let output = Vec::new();
        let mut transport = StdioTransport::new(input, output);

        let response = serde_json::json!({"test": "response"});
        let result = transport.send_response(response).await;
        assert!(result.is_ok());
    }
}