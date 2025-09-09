use thiserror::Error;

pub type Result<T> = std::result::Result<T, ConfigError>;

#[derive(Error, Debug)]
pub enum ConfigError {
    #[error("Environment variable error: {0}")]
    EnvVar(#[from] std::env::VarError),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("YAML parsing error: {0}")]
    Yaml(#[from] serde_yaml::Error),

    #[error("JSON parsing error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Missing required configuration: {0}")]
    MissingRequired(String),

    #[error("Invalid configuration value: {field} = {value}")]
    InvalidValue { field: String, value: String },

    #[error("Configuration validation failed: {0}")]
    Validation(String),

    #[error("Unsupported configuration format: {0}")]
    UnsupportedFormat(String),

    #[error("Configuration file not found: {0}")]
    FileNotFound(String),

    #[error("Permission denied accessing configuration: {0}")]
    PermissionDenied(String),
}
