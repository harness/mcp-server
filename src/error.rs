use thiserror::Error;

#[derive(Error, Debug)]
pub enum HarnessError {
    #[error("HTTP client error: {0}")]
    Http(#[from] reqwest::Error),
    
    #[error("JSON serialization error: {0}")]
    Json(#[from] serde_json::Error),
    
    #[error("Configuration error: {0}")]
    Config(#[from] figment::Error),
    
    #[error("Authentication error: {message}")]
    Auth { message: String },
    
    #[error("Bad request: {message}")]
    BadRequest { message: String },
    
    #[error("Not found: {message}")]
    NotFound { message: String },
    
    #[error("Internal server error: {message}")]
    Internal { message: String },
    
    #[error("Invalid API key format")]
    InvalidApiKey,
    
    #[error("Missing required parameter: {param}")]
    MissingParameter { param: String },
    
    #[error("Invalid parameter value: {param} = {value}")]
    InvalidParameter { param: String, value: String },
    
    #[error("Service unavailable: {service}")]
    ServiceUnavailable { service: String },
    
    #[error("Rate limit exceeded")]
    RateLimitExceeded,
    
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("URL parse error: {0}")]
    UrlParse(#[from] url::ParseError),
}

impl HarnessError {
    pub fn auth(message: impl Into<String>) -> Self {
        Self::Auth {
            message: message.into(),
        }
    }
    
    pub fn bad_request(message: impl Into<String>) -> Self {
        Self::BadRequest {
            message: message.into(),
        }
    }
    
    pub fn not_found(message: impl Into<String>) -> Self {
        Self::NotFound {
            message: message.into(),
        }
    }
    
    pub fn internal(message: impl Into<String>) -> Self {
        Self::Internal {
            message: message.into(),
        }
    }
    
    pub fn missing_parameter(param: impl Into<String>) -> Self {
        Self::MissingParameter {
            param: param.into(),
        }
    }
    
    pub fn invalid_parameter(param: impl Into<String>, value: impl Into<String>) -> Self {
        Self::InvalidParameter {
            param: param.into(),
            value: value.into(),
        }
    }
    
    pub fn service_unavailable(service: impl Into<String>) -> Self {
        Self::ServiceUnavailable {
            service: service.into(),
        }
    }
    
    /// Convert to HTTP status code
    pub fn status_code(&self) -> u16 {
        match self {
            Self::Auth { .. } => 401,
            Self::BadRequest { .. } | Self::InvalidApiKey | Self::MissingParameter { .. } | Self::InvalidParameter { .. } => 400,
            Self::NotFound { .. } => 404,
            Self::RateLimitExceeded => 429,
            Self::ServiceUnavailable { .. } => 503,
            _ => 500,
        }
    }
}

pub type Result<T> = std::result::Result<T, HarnessError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_auth_error() {
        let error = HarnessError::auth("Invalid credentials");
        assert_eq!(error.to_string(), "Authentication error: Invalid credentials");
        assert_eq!(error.status_code(), 401);
    }

    #[test]
    fn test_bad_request_error() {
        let error = HarnessError::bad_request("Invalid input");
        assert_eq!(error.to_string(), "Bad request: Invalid input");
        assert_eq!(error.status_code(), 400);
    }

    #[test]
    fn test_not_found_error() {
        let error = HarnessError::not_found("Resource not found");
        assert_eq!(error.to_string(), "Not found: Resource not found");
        assert_eq!(error.status_code(), 404);
    }

    #[test]
    fn test_internal_error() {
        let error = HarnessError::internal("Database connection failed");
        assert_eq!(error.to_string(), "Internal server error: Database connection failed");
        assert_eq!(error.status_code(), 500);
    }

    #[test]
    fn test_missing_parameter_error() {
        let error = HarnessError::missing_parameter("orgIdentifier");
        assert_eq!(error.to_string(), "Missing required parameter: orgIdentifier");
        assert_eq!(error.status_code(), 400);
    }

    #[test]
    fn test_invalid_parameter_error() {
        let error = HarnessError::invalid_parameter("page", "-1");
        assert_eq!(error.to_string(), "Invalid parameter value: page = -1");
        assert_eq!(error.status_code(), 400);
    }

    #[test]
    fn test_service_unavailable_error() {
        let error = HarnessError::service_unavailable("pipeline-service");
        assert_eq!(error.to_string(), "Service unavailable: pipeline-service");
        assert_eq!(error.status_code(), 503);
    }

    #[test]
    fn test_invalid_api_key_error() {
        let error = HarnessError::InvalidApiKey;
        assert_eq!(error.to_string(), "Invalid API key format");
        assert_eq!(error.status_code(), 400);
    }

    #[test]
    fn test_rate_limit_exceeded_error() {
        let error = HarnessError::RateLimitExceeded;
        assert_eq!(error.to_string(), "Rate limit exceeded");
        assert_eq!(error.status_code(), 429);
    }

    #[test]
    fn test_json_error_conversion() {
        let json_error = serde_json::from_str::<serde_json::Value>("invalid json");
        assert!(json_error.is_err());
        
        let harness_error: HarnessError = json_error.unwrap_err().into();
        assert!(matches!(harness_error, HarnessError::Json(_)));
        assert_eq!(harness_error.status_code(), 500);
    }

    #[test]
    fn test_url_parse_error_conversion() {
        let url_error = url::Url::parse("not a url");
        assert!(url_error.is_err());
        
        let harness_error: HarnessError = url_error.unwrap_err().into();
        assert!(matches!(harness_error, HarnessError::UrlParse(_)));
        assert_eq!(harness_error.status_code(), 500);
    }

    #[test]
    fn test_error_debug() {
        let error = HarnessError::auth("test");
        let debug_str = format!("{:?}", error);
        assert!(debug_str.contains("Auth"));
        assert!(debug_str.contains("test"));
    }

    #[test]
    fn test_result_type() {
        fn test_function() -> Result<String> {
            Ok("success".to_string())
        }
        
        let result = test_function();
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "success");
    }

    #[test]
    fn test_result_type_error() {
        fn test_function() -> Result<String> {
            Err(HarnessError::auth("failed"))
        }
        
        let result = test_function();
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), HarnessError::Auth { .. }));
    }
}