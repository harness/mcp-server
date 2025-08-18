//! Utility functions and helpers

use crate::Result;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

/// Get current timestamp in seconds since Unix epoch
pub fn current_timestamp() -> Result<u64> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .map_err(|e| crate::Error::Internal(e.into()))
}

/// Parse duration from string (e.g., "30s", "5m", "1h")
pub fn parse_duration(s: &str) -> Result<Duration> {
    if s.is_empty() {
        return Ok(Duration::from_secs(0));
    }

    let (value_str, unit) = if let Some(pos) = s.find(|c: char| c.is_alphabetic()) {
        s.split_at(pos)
    } else {
        (s, "s") // Default to seconds
    };

    let value: u64 = value_str.parse()
        .map_err(|_| crate::Error::validation(format!("Invalid duration value: {}", value_str)))?;

    let multiplier = match unit {
        "s" | "sec" | "second" | "seconds" => 1,
        "m" | "min" | "minute" | "minutes" => 60,
        "h" | "hr" | "hour" | "hours" => 3600,
        "d" | "day" | "days" => 86400,
        _ => return Err(crate::Error::validation(format!("Invalid duration unit: {}", unit))),
    };

    Ok(Duration::from_secs(value * multiplier))
}

/// Retry configuration
#[derive(Debug, Clone)]
pub struct RetryConfig {
    pub max_attempts: usize,
    pub initial_delay: Duration,
    pub max_delay: Duration,
    pub backoff_factor: f64,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_attempts: 3,
            initial_delay: Duration::from_millis(100),
            max_delay: Duration::from_secs(30),
            backoff_factor: 2.0,
        }
    }
}

/// Retry a future with exponential backoff
pub async fn retry_with_backoff<F, Fut, T, E>(
    mut operation: F,
    config: RetryConfig,
) -> std::result::Result<T, E>
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = std::result::Result<T, E>>,
    E: std::fmt::Debug,
{
    let mut delay = config.initial_delay;
    
    for attempt in 1..=config.max_attempts {
        match operation().await {
            Ok(result) => return Ok(result),
            Err(error) => {
                if attempt == config.max_attempts {
                    return Err(error);
                }
                
                tracing::warn!(
                    "Attempt {} failed, retrying in {:?}: {:?}",
                    attempt,
                    delay,
                    error
                );
                
                tokio::time::sleep(delay).await;
                
                // Exponential backoff with jitter
                delay = std::cmp::min(
                    Duration::from_millis(
                        (delay.as_millis() as f64 * config.backoff_factor) as u64
                    ),
                    config.max_delay,
                );
            }
        }
    }
    
    unreachable!()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_duration() {
        assert_eq!(parse_duration("30s").unwrap(), Duration::from_secs(30));
        assert_eq!(parse_duration("5m").unwrap(), Duration::from_secs(300));
        assert_eq!(parse_duration("1h").unwrap(), Duration::from_secs(3600));
        assert_eq!(parse_duration("2d").unwrap(), Duration::from_secs(172800));
        assert!(parse_duration("invalid").is_err());
    }
}