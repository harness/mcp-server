#[cfg(test)]
mod tests {
    use crate::config::Config;
    use crate::types::enums::{LogFormatType, TransportType};

    #[test]
    fn test_config_default() {
        let config = Config::default();
        assert_eq!(config.base_url, "https://app.harness.io");
        assert_eq!(config.log_format, LogFormatType::Text);
        assert_eq!(config.transport, TransportType::Stdio);
        assert!(!config.read_only);
        assert!(!config.enable_license);
    }

    #[test]
    fn test_config_with_api_key() {
        let mut config = Config::default();
        config.api_key = Some("test_key".to_string());
        assert_eq!(config.api_key, Some("test_key".to_string()));
    }

    #[test]
    fn test_config_toolsets() {
        let mut config = Config::default();
        config.toolsets = vec!["pipelines".to_string(), "connectors".to_string()];
        assert_eq!(config.toolsets.len(), 2);
        assert!(config.toolsets.contains(&"pipelines".to_string()));
    }
}