package dto

// SecretResponse represents the response from the Harness secrets API
type SecretResponse struct {
	Status        string      `json:"status"`
	Data          SecretData  `json:"data"`
	MetaData      interface{} `json:"metaData"`
	CorrelationID string      `json:"correlationId"`
}

// SecretData represents the data field in the secret response
type SecretData struct {
	Secret    Secret `json:"secret"`
	CreatedAt int64  `json:"createdAt"`
	UpdatedAt int64  `json:"updatedAt"`
	Draft     bool   `json:"draft"`
}

// Secret represents the details of a Harness secret
type Secret struct {
	Type        string            `json:"type"`
	Name        string            `json:"name"`
	Identifier  string            `json:"identifier"`
	Tags        map[string]string `json:"tags"`
	Description string            `json:"description"`
	Spec        SecretSpec        `json:"spec"`
}

// SecretSpec represents the specification of a secret
type SecretSpec struct {
	SecretManagerIdentifier string      `json:"secretManagerIdentifier"`
	AdditionalMetadata      interface{} `json:"additionalMetadata"`
}

// SecretGetOptions represents options for getting a secret
type SecretGetOptions struct {
	// Add any additional options needed for getting secrets
}
