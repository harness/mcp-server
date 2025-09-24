use crate::config::Config;
use crate::error::Result;
use tracing_subscriber::{
    fmt::{self, format::FmtSpan},
    layer::SubscriberExt,
    util::SubscriberInitExt,
    EnvFilter, Layer,
};

/// Initialize logging for stdio mode (structured JSON to stderr)
pub fn init_stdio_logging(config: &Config) -> Result<()> {
    let filter = create_env_filter(config);

    let stderr_layer = fmt::layer()
        .json()
        .with_writer(std::io::stderr)
        .with_span_events(FmtSpan::CLOSE)
        .with_filter(filter);

    tracing_subscriber::registry().with(stderr_layer).init();

    Ok(())
}

/// Initialize logging for file mode (structured JSON to file)
pub fn init_file_logging(config: &Config) -> Result<()> {
    let filter = create_env_filter(config);

    if let Some(ref log_file) = config.log_file {
        let file_appender = tracing_appender::rolling::daily(
            std::path::Path::new(log_file).parent().unwrap_or_else(|| std::path::Path::new(".")),
            std::path::Path::new(log_file)
                .file_stem()
                .unwrap_or_else(|| std::ffi::OsStr::new("harness-mcp-server")),
        );
        let (non_blocking, _guard) = tracing_appender::non_blocking(file_appender);

        let file_layer = fmt::layer()
            .json()
            .with_writer(non_blocking)
            .with_span_events(FmtSpan::CLOSE)
            .with_filter(filter);

        tracing_subscriber::registry().with(file_layer).init();

        // Store the guard to prevent it from being dropped
        std::mem::forget(_guard);
    } else {
        // Fall back to stderr if no log file specified
        init_stdio_logging(config)?;
    }

    Ok(())
}

fn create_env_filter(config: &Config) -> EnvFilter {
    let default_level = if config.debug { "debug" } else { "info" };
    
    EnvFilter::try_from_default_env()
        .or_else(|_| EnvFilter::try_new(default_level))
        .unwrap_or_else(|_| EnvFilter::new("info"))
}