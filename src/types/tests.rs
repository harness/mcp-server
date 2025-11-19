#[cfg(test)]
mod tests {
    use crate::types::enums::*;
    use serde_json;

    #[test]
    fn test_transport_type_serialization() {
        let stdio = TransportType::Stdio;
        let json = serde_json::to_string(&stdio).unwrap();
        assert_eq!(json, "\"stdio\"");

        let http = TransportType::Http;
        let json = serde_json::to_string(&http).unwrap();
        assert_eq!(json, "\"http\"");
    }

    #[test]
    fn test_transport_type_deserialization() {
        let stdio: TransportType = serde_json::from_str("\"stdio\"").unwrap();
        assert_eq!(stdio, TransportType::Stdio);

        let http: TransportType = serde_json::from_str("\"http\"").unwrap();
        assert_eq!(http, TransportType::Http);
    }

    #[test]
    fn test_log_format_type_serialization() {
        let text = LogFormatType::Text;
        let json = serde_json::to_string(&text).unwrap();
        assert_eq!(json, "\"text\"");

        let json_format = LogFormatType::Json;
        let json = serde_json::to_string(&json_format).unwrap();
        assert_eq!(json, "\"json\"");
    }

    #[test]
    fn test_license_status_variants() {
        let active = LicenseStatus::Active;
        let expired = LicenseStatus::Expired;
        let inactive = LicenseStatus::Inactive;

        // Test that all variants exist and can be created
        assert!(matches!(active, LicenseStatus::Active));
        assert!(matches!(expired, LicenseStatus::Expired));
        assert!(matches!(inactive, LicenseStatus::Inactive));
    }
}