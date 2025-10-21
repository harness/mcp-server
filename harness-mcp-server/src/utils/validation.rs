use regex::Regex;
use std::sync::OnceLock;

/// Validate if a string is a valid identifier (alphanumeric + underscores, no spaces)
pub fn is_valid_identifier(s: &str) -> bool {
    static IDENTIFIER_REGEX: OnceLock<Regex> = OnceLock::new();
    let regex = IDENTIFIER_REGEX.get_or_init(|| {
        Regex::new(r"^[a-zA-Z_][a-zA-Z0-9_]*$").unwrap()
    });
    
    !s.is_empty() && regex.is_match(s)
}

/// Validate if a string is a valid email address
pub fn is_valid_email(email: &str) -> bool {
    static EMAIL_REGEX: OnceLock<Regex> = OnceLock::new();
    let regex = EMAIL_REGEX.get_or_init(|| {
        Regex::new(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$").unwrap()
    });
    
    regex.is_match(email)
}

/// Validate if a string is a valid URL
pub fn is_valid_url(url: &str) -> bool {
    url::Url::parse(url).is_ok()
}

/// Validate if a string is a valid UUID
pub fn is_valid_uuid(uuid: &str) -> bool {
    uuid::Uuid::parse_str(uuid).is_ok()
}

/// Validate pagination parameters
pub fn validate_pagination(page: i32, size: i32) -> Result<(), String> {
    if page < 0 {
        return Err("Page must be non-negative".to_string());
    }
    
    if size <= 0 {
        return Err("Size must be positive".to_string());
    }
    
    if size > 100 {
        return Err("Size must not exceed 100".to_string());
    }
    
    Ok(())
}

/// Validate if a string is not empty and within length limits
pub fn validate_string_length(s: &str, min_len: usize, max_len: usize) -> Result<(), String> {
    let len = s.len();
    
    if len < min_len {
        return Err(format!("String must be at least {} characters long", min_len));
    }
    
    if len > max_len {
        return Err(format!("String must not exceed {} characters", max_len));
    }
    
    Ok(())
}

/// Validate if a string contains only allowed characters
pub fn validate_allowed_chars(s: &str, allowed_pattern: &str) -> Result<(), String> {
    let regex = Regex::new(allowed_pattern)
        .map_err(|_| "Invalid regex pattern".to_string())?;
    
    if regex.is_match(s) {
        Ok(())
    } else {
        Err(format!("String contains invalid characters. Allowed pattern: {}", allowed_pattern))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_valid_identifier() {
        assert!(is_valid_identifier("valid_identifier"));
        assert!(is_valid_identifier("_underscore"));
        assert!(is_valid_identifier("with123numbers"));
        
        assert!(!is_valid_identifier(""));
        assert!(!is_valid_identifier("123starts_with_number"));
        assert!(!is_valid_identifier("has spaces"));
        assert!(!is_valid_identifier("has-dashes"));
    }

    #[test]
    fn test_is_valid_email() {
        assert!(is_valid_email("test@example.com"));
        assert!(is_valid_email("user.name+tag@domain.co.uk"));
        
        assert!(!is_valid_email("invalid"));
        assert!(!is_valid_email("@domain.com"));
        assert!(!is_valid_email("user@"));
    }

    #[test]
    fn test_is_valid_url() {
        assert!(is_valid_url("https://example.com"));
        assert!(is_valid_url("http://localhost:8080/path"));
        
        assert!(!is_valid_url("not-a-url"));
        assert!(!is_valid_url("ftp://"));
    }

    #[test]
    fn test_validate_pagination() {
        assert!(validate_pagination(0, 20).is_ok());
        assert!(validate_pagination(1, 50).is_ok());
        
        assert!(validate_pagination(-1, 20).is_err());
        assert!(validate_pagination(0, 0).is_err());
        assert!(validate_pagination(0, 101).is_err());
    }

    #[test]
    fn test_validate_string_length() {
        assert!(validate_string_length("hello", 1, 10).is_ok());
        
        assert!(validate_string_length("", 1, 10).is_err());
        assert!(validate_string_length("too long string", 1, 5).is_err());
    }
}