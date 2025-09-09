// Transport layer abstractions for stdio and HTTP
use crate::Result;
use std::io::{Read, Write};

pub trait Transport {
    async fn start(&self) -> Result<()>;
}

pub struct StdioTransport<R: Read, W: Write> {
    input: R,
    output: W,
}

impl<R: Read, W: Write> StdioTransport<R, W> {
    pub fn new(input: R, output: W) -> Self {
        Self { input, output }
    }
}

impl<R: Read + Send + 'static, W: Write + Send + 'static> Transport for StdioTransport<R, W> {
    async fn start(&self) -> Result<()> {
        // Implementation would go here for stdio transport
        Ok(())
    }
}

pub struct HttpTransport {
    port: u16,
    path: String,
}

impl HttpTransport {
    pub fn new(port: u16, path: String) -> Self {
        Self { port, path }
    }
}

impl Transport for HttpTransport {
    async fn start(&self) -> Result<()> {
        // Implementation would go here for HTTP transport
        Ok(())
    }
}
