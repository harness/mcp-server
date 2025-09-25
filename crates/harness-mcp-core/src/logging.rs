//! Logging and observability for Harness MCP Server
//!
//! This module provides structured logging, tracing, and observability features
//! compatible with the Go implementation while leveraging Rust's tracing ecosystem.

use std::io;
use std::path::Path;
use tracing::{Level, Subscriber};
use tracing_subscriber::{
    fmt::{self, format::FmtSpan},
    layer::SubscriberExt,
    util::SubscriberInitExt,
    EnvFilter, Layer, Registry,
};

/// Logging configuration
#[derive(Debug, Clone)]
pub struct LoggingConfig {
    /// Log level (trace, debug, info, warn, error)
    pub level: Level,
    
    /// Log file path (optional)
    pub file_path: Option<String>,
    
    /// Enable debug mode
    pub debug: bool,
    
    /// Enable JSON formatting
    pub json_format: bool,
    
    /// Enable OpenTelemetry integration
    pub enable_otel: bool,
    
    /// Service name for tracing
    pub service_name: String,
    
    /// Service version for tracing
    pub service_version: String,
}

impl Default for LoggingConfig {
    fn default() -> Self {
        Self {
            level: Level::INFO,
            file_path: None,
            debug: false,
            json_format: false,
            enable_otel: false,
            service_name: "harness-mcp-server".to_string(),
            service_version: env!("CARGO_PKG_VERSION").to_string(),
        }
    }
}

/// Initialize logging and tracing
pub fn init_logging(config: &LoggingConfig) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Create environment filter
    let env_filter = EnvFilter::try_from_default_env()
        .or_else(|_| EnvFilter::try_new(config.level.as_str()))?;

    // Create registry
    let registry = Registry::default().with(env_filter);

    // Add console layer
    let console_layer = if config.json_format {
        fmt::layer()
            .json()
            .with_span_events(FmtSpan::CLOSE)
            .with_target(true)
            .with_thread_ids(true)
            .with_thread_names(true)
            .boxed()
    } else {
        fmt::layer()
            .with_span_events(FmtSpan::CLOSE)
            .with_target(true)
            .with_thread_ids(config.debug)
            .with_thread_names(config.debug)
            .boxed()
    };

    let registry = registry.with(console_layer);

    // Add file layer if configured
    let registry = if let Some(file_path) = &config.file_path {
        let file = std::fs::OpenOptions::new()
            .create(true)
            .write(true)
            .append(true)
            .open(file_path)?;

        let file_layer = if config.json_format {
            fmt::layer()
                .json()
                .with_writer(file)
                .with_span_events(FmtSpan::CLOSE)
                .with_target(true)
                .with_thread_ids(true)
                .with_thread_names(true)
                .boxed()
        } else {
            fmt::layer()
                .with_writer(file)
                .with_span_events(FmtSpan::CLOSE)
                .with_target(true)
                .with_thread_ids(config.debug)
                .with_thread_names(config.debug)
                .boxed()
        };

        registry.with(file_layer)
    } else {
        registry
    };

    // Initialize the subscriber
    registry.init();

    tracing::info!(
        service_name = config.service_name,
        service_version = config.service_version,
        log_level = %config.level,
        debug_mode = config.debug,
        json_format = config.json_format,
        file_path = config.file_path.as_deref().unwrap_or("none"),
        "Logging initialized"
    );

    Ok(())
}

/// Initialize logging from environment variables (Go compatibility)
pub fn init_logging_from_env() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let mut config = LoggingConfig::default();

    // Check for debug mode
    if let Ok(debug) = std::env::var("HARNESS_DEBUG") {
        config.debug = debug.parse().unwrap_or(false);
        if config.debug {
            config.level = Level::DEBUG;
        }
    }

    // Check for log file
    if let Ok(log_file) = std::env::var("HARNESS_LOG_FILE") {
        config.file_path = Some(log_file);
    }

    // Check for JSON format
    if let Ok(json) = std::env::var("HARNESS_LOG_JSON") {
        config.json_format = json.parse().unwrap_or(false);
    }

    // Check for log level
    if let Ok(level) = std::env::var("HARNESS_LOG_LEVEL") {
        config.level = match level.to_lowercase().as_str() {
            "trace" => Level::TRACE,
            "debug" => Level::DEBUG,
            "info" => Level::INFO,
            "warn" => Level::WARN,
            "error" => Level::ERROR,
            _ => Level::INFO,
        };
    }

    init_logging(&config)
}

/// Logging macros for compatibility with Go slog patterns
#[macro_export]
macro_rules! log_info {
    ($msg:expr, $($key:expr => $value:expr),*) => {
        tracing::info!($($key = ?$value,)* "{}", $msg);
    };
    ($msg:expr) => {
        tracing::info!("{}", $msg);
    };
}

#[macro_export]
macro_rules! log_error {
    ($msg:expr, $($key:expr => $value:expr),*) => {
        tracing::error!($($key = ?$value,)* "{}", $msg);
    };
    ($msg:expr) => {
        tracing::error!("{}", $msg);
    };
}

#[macro_export]
macro_rules! log_warn {
    ($msg:expr, $($key:expr => $value:expr),*) => {
        tracing::warn!($($key = ?$value,)* "{}", $msg);
    };
    ($msg:expr) => {
        tracing::warn!("{}", $msg);
    };
}

#[macro_export]
macro_rules! log_debug {
    ($msg:expr, $($key:expr => $value:expr),*) => {
        tracing::debug!($($key = ?$value,)* "{}", $msg);
    };
    ($msg:expr) => {
        tracing::debug!("{}", $msg);
    };
}

/// Span creation for request tracing
pub fn create_request_span(method: &str, path: &str, request_id: &str) -> tracing::Span {
    tracing::info_span!(
        "request",
        method = method,
        path = path,
        request_id = request_id,
        status_code = tracing::field::Empty,
        duration_ms = tracing::field::Empty,
    )
}

/// Span creation for tool execution tracing
pub fn create_tool_span(tool_name: &str, tool_id: &str) -> tracing::Span {
    tracing::info_span!(
        "tool_execution",
        tool_name = tool_name,
        tool_id = tool_id,
        success = tracing::field::Empty,
        duration_ms = tracing::field::Empty,
        error = tracing::field::Empty,
    )
}

/// Span creation for authentication tracing
pub fn create_auth_span(auth_type: &str, account_id: Option<&str>) -> tracing::Span {
    tracing::info_span!(
        "authentication",
        auth_type = auth_type,
        account_id = account_id,
        success = tracing::field::Empty,
        error = tracing::field::Empty,
    )
}

/// Metrics collection trait
pub trait MetricsCollector {
    /// Record request metrics
    fn record_request(&self, method: &str, path: &str, status_code: u16, duration_ms: u64);
    
    /// Record tool execution metrics
    fn record_tool_execution(&self, tool_name: &str, success: bool, duration_ms: u64);
    
    /// Record authentication metrics
    fn record_authentication(&self, auth_type: &str, success: bool);
    
    /// Increment counter
    fn increment_counter(&self, name: &str, labels: &[(&str, &str)]);
    
    /// Record histogram
    fn record_histogram(&self, name: &str, value: f64, labels: &[(&str, &str)]);
}

/// No-op metrics collector for when metrics are disabled
pub struct NoOpMetricsCollector;

impl MetricsCollector for NoOpMetricsCollector {
    fn record_request(&self, _method: &str, _path: &str, _status_code: u16, _duration_ms: u64) {}
    fn record_tool_execution(&self, _tool_name: &str, _success: bool, _duration_ms: u64) {}
    fn record_authentication(&self, _auth_type: &str, _success: bool) {}
    fn increment_counter(&self, _name: &str, _labels: &[(&str, &str)]) {}
    fn record_histogram(&self, _name: &str, _value: f64, _labels: &[(&str, &str)]) {}
}

/// Request context for tracing
#[derive(Debug, Clone)]
pub struct RequestContext {
    pub request_id: String,
    pub method: String,
    pub path: String,
    pub user_agent: Option<String>,
    pub account_id: Option<String>,
    pub start_time: std::time::Instant,
}

impl RequestContext {
    pub fn new(method: String, path: String) -> Self {
        Self {
            request_id: uuid::Uuid::new_v4().to_string(),
            method,
            path,
            user_agent: None,
            account_id: None,
            start_time: std::time::Instant::now(),
        }
    }

    pub fn duration_ms(&self) -> u64 {
        self.start_time.elapsed().as_millis() as u64
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Once;

    static INIT: Once = Once::new();

    fn init_test_logging() {
        INIT.call_once(|| {
            let config = LoggingConfig {
                level: Level::DEBUG,
                debug: true,
                json_format: false,
                ..Default::default()
            };
            let _ = init_logging(&config);
        });
    }

    #[test]
    fn test_logging_config_default() {
        let config = LoggingConfig::default();
        assert_eq!(config.level, Level::INFO);
        assert!(!config.debug);
        assert!(!config.json_format);
        assert_eq!(config.service_name, "harness-mcp-server");
    }

    #[test]
    fn test_request_context() {
        let ctx = RequestContext::new("GET".to_string(), "/health".to_string());
        assert_eq!(ctx.method, "GET");
        assert_eq!(ctx.path, "/health");
        assert!(!ctx.request_id.is_empty());
    }

    #[test]
    fn test_logging_macros() {
        init_test_logging();
        
        log_info!("Test info message");
        log_info!("Test info with data", "key" => "value", "number" => 42);
        
        log_error!("Test error message");
        log_warn!("Test warning message");
        log_debug!("Test debug message");
    }

    #[test]
    fn test_span_creation() {
        init_test_logging();
        
        let _request_span = create_request_span("GET", "/api/tools", "req-123");
        let _tool_span = create_tool_span("list_pipelines", "tool-456");
        let _auth_span = create_auth_span("api_key", Some("account-789"));
    }

    #[test]
    fn test_metrics_collector() {
        let collector = NoOpMetricsCollector;
        collector.record_request("GET", "/health", 200, 50);
        collector.record_tool_execution("test_tool", true, 100);
        collector.record_authentication("api_key", true);
        collector.increment_counter("test_counter", &[("label", "value")]);
        collector.record_histogram("test_histogram", 1.5, &[("type", "test")]);
    }
}