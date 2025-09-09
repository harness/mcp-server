use thiserror::Error;

pub type Result<T> = std::result::Result<T, McpError>;

#[derive(Error, Debug)]
pub enum McpError {
    #[error("JSON-RPC error: {0}")]
    JsonRpc(#[from] jsonrpc_core::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Authentication error: {0}")]
    Auth(#[from] harness_mcp_auth::AuthError),

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Tool error: {0}")]
    Tool(#[from] harness_mcp_tools::ToolError),

    #[error("Client error: {0}")]
    Client(#[from] harness_mcp_client::Error),

    #[error("Invalid request: {0}")]
    InvalidRequest(String),

    #[error("Method not found: {0}")]
    MethodNotFound(String),

    #[error("Internal error: {0}")]
    Internal(String),

    #[error("Transport error: {0}")]
    Transport(String),

    #[error("Protocol error: {0}")]
    Protocol(String),

    #[error("Timeout error: {0}")]
    Timeout(String),

    #[error("Network error: {0}")]
    Network(String),

    #[error("Parse error: {0}")]
    Parse(String),

    #[error("Validation error: {0}")]
    Validation(String),
}

impl From<McpError> for jsonrpc_core::Error {
    fn from(err: McpError) -> Self {
        match err {
            McpError::JsonRpc(e) => e,
            McpError::InvalidRequest(_) => {
                jsonrpc_core::Error::invalid_request()
            }
            McpError::MethodNotFound(_) => {
                jsonrpc_core::Error::method_not_found()
            }
            McpError::Parse(_) => {
                jsonrpc_core::Error::parse_error()
            }
            _ => jsonrpc_core::Error::internal_error(),
        }
    }
}


impl From<harness_mcp_config::ConfigError> for McpError {
    fn from(err: harness_mcp_config::ConfigError) -> Self {
        McpError::Config(err.to_string())
    }
}

// Helper methods for error handling
impl McpError {
    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            McpError::Timeout(_) | McpError::Network(_) | McpError::Transport(_)
        )
    }

    pub fn is_client_error(&self) -> bool {
        matches!(
            self,
            McpError::InvalidRequest(_) | McpError::Validation(_) | McpError::Parse(_)
        )
    }

    pub fn is_server_error(&self) -> bool {
        matches!(self, McpError::Internal(_))
    }

    pub fn error_code(&self) -> i32 {
        match self {
            McpError::InvalidRequest(_) => -32600,
            McpError::MethodNotFound(_) => -32601,
            McpError::Parse(_) => -32700,
            McpError::Auth(_) => -32001,
            McpError::Config(_) => -32002,
            McpError::Tool(_) => -32003,
            McpError::Client(_) => -32004,
            _ => -32603, // Internal error
        }
    }
}
