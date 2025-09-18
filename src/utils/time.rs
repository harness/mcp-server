use chrono::{DateTime, TimeZone, Utc};

/// Convert Unix timestamp in milliseconds to RFC3339 format
pub fn format_unix_millis_to_rfc3339(ms: i64) -> String {
    if ms <= 0 {
        return String::new();
    }
    
    // Convert milliseconds to seconds and nanoseconds
    let secs = ms / 1000;
    let nanos = ((ms % 1000) * 1_000_000) as u32;
    
    match Utc.timestamp_opt(secs, nanos) {
        chrono::LocalResult::Single(dt) => dt.to_rfc3339(),
        _ => String::new(),
    }
}

/// Convert RFC3339 string to Unix timestamp in milliseconds
pub fn parse_rfc3339_to_unix_millis(rfc3339: &str) -> Result<i64, chrono::ParseError> {
    let dt = DateTime::parse_from_rfc3339(rfc3339)?;
    Ok(dt.timestamp_millis())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_unix_millis_to_rfc3339() {
        // Test with a known timestamp
        let ms = 1640995200000; // 2022-01-01T00:00:00Z
        let result = format_unix_millis_to_rfc3339(ms);
        assert_eq!(result, "2022-01-01T00:00:00+00:00");

        // Test with zero
        assert_eq!(format_unix_millis_to_rfc3339(0), "");

        // Test with negative
        assert_eq!(format_unix_millis_to_rfc3339(-1), "");
    }

    #[test]
    fn test_parse_rfc3339_to_unix_millis() {
        let rfc3339 = "2022-01-01T00:00:00+00:00";
        let result = parse_rfc3339_to_unix_millis(rfc3339).unwrap();
        assert_eq!(result, 1640995200000);
    }
}