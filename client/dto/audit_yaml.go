package dto

// AuditYamlResponse represents the response from the audit YAML API
type AuditYamlResponse struct {
	Status     string           `json:"status"`
	Data       AuditYamlData    `json:"data"`
	MetaData   interface{}      `json:"metaData"`
	CorrelationID string        `json:"correlationId"`
}

// AuditYamlData contains the old and new YAML content for an audit event
type AuditYamlData struct {
	OldYaml string `json:"oldYaml"`
	NewYaml string `json:"newYaml"`
}
