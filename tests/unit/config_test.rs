#[cfg(test)]
mod tests {
    use harness_mcp_server::config::Config;
    use harness_mcp_server::types::TransportType;

    #[test]
    fn test_config_default() {
        let config = Config::default();
        assert_eq!(config.version, env!("CARGO_PKG_VERSION"));
        assert!(!config.read_only);
        assert_eq!(config.transport, TransportType::Stdio);
        assert_eq!(config.http.port, 8080);
        assert_eq!(config.http.path, "/mcp");
    }

    #[test]
    fn test_config_serialization() {
        let config = Config::default();
        let serialized = serde_json::to_string(&config).expect("Failed to serialize config");
        let deserialized: Config = serde_json::from_str(&serialized).expect("Failed to deserialize config");
        
        assert_eq!(config.version, deserialized.version);
        assert_eq!(config.read_only, deserialized.read_only);
        assert_eq!(config.transport, deserialized.transport);
    }
}