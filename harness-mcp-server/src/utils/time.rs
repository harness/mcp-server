use time::{OffsetDateTime, format_description::well_known::Rfc3339};

/// Convert Unix timestamp in milliseconds to RFC3339 string
pub fn format_unix_millis_to_rfc3339(ms: i64) -> String {
    if ms <= 0 {
        return String::new();
    }
    
    let seconds = ms / 1000;
    let nanoseconds = (ms % 1000) * 1_000_000;
    
    match OffsetDateTime::from_unix_timestamp_nanos((seconds * 1_000_000_000) as i128 + nanoseconds as i128) {
        Ok(datetime) => datetime.format(&Rfc3339).unwrap_or_default(),
        Err(_) => String::new(),
    }
}

/// Convert RFC3339 string to Unix timestamp in milliseconds
pub fn parse_rfc3339_to_unix_millis(rfc3339: &str) -> Result<i64, time::error::Parse> {
    let datetime = OffsetDateTime::parse(rfc3339, &Rfc3339)?;
    Ok(datetime.unix_timestamp() * 1000 + datetime.millisecond() as i64)
}

/// Get current Unix timestamp in milliseconds
pub fn current_unix_millis() -> i64 {
    OffsetDateTime::now_utc().unix_timestamp() * 1000
}

/// Convert Unix timestamp in seconds to milliseconds
pub fn unix_seconds_to_millis(seconds: i64) -> i64 {
    seconds * 1000
}

/// Convert Unix timestamp in milliseconds to seconds
pub fn unix_millis_to_seconds(millis: i64) -> i64 {
    millis / 1000
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_unix_millis_to_rfc3339() {
        // Test with a known timestamp: 2023-01-01T00:00:00Z = 1672531200000ms
        let timestamp = 1672531200000;
        let formatted = format_unix_millis_to_rfc3339(timestamp);
        assert_eq!(formatted, "2023-01-01T00:00:00Z");
        
        // Test with zero
        assert_eq!(format_unix_millis_to_rfc3339(0), "");
        
        // Test with negative
        assert_eq!(format_unix_millis_to_rfc3339(-1), "");
    }

    #[test]
    fn test_parse_rfc3339_to_unix_millis() {
        let rfc3339 = "2023-01-01T00:00:00.000Z";
        let result = parse_rfc3339_to_unix_millis(rfc3339);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 1672531200000);
    }

    #[test]
    fn test_unix_conversions() {
        let seconds = 1672531200;
        let millis = unix_seconds_to_millis(seconds);
        assert_eq!(millis, 1672531200000);
        
        let back_to_seconds = unix_millis_to_seconds(millis);
        assert_eq!(back_to_seconds, seconds);
    }

    #[test]
    fn test_current_unix_millis() {
        let now = current_unix_millis();
        assert!(now > 0);
        // Should be a reasonable timestamp (after 2020)
        assert!(now > 1577836800000); // 2020-01-01
    }
}