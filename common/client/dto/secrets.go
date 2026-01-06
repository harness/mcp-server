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

// ListSecretsResponse represents the response from the list secrets API
type ListSecretsResponse struct {
	Status        string          `json:"status"`
	Data          ListSecretsData `json:"data"`
	MetaData      interface{}     `json:"metaData"`
	CorrelationID string          `json:"correlationId"`
}

// ListSecretsData represents the data field in the list secrets response
type ListSecretsData struct {
	TotalPages    int          `json:"totalPages"`
	TotalItems    int          `json:"totalItems"`
	PageItemCount int          `json:"pageItemCount"`
	PageSize      int          `json:"pageSize"`
	Content       []SecretData `json:"content"`
}

// SecretFilterProperties represents the filter properties for listing secrets
type SecretFilterProperties struct {
	SecretName                         string            `json:"secretName,omitempty"`
	SecretIdentifier                   string            `json:"secretIdentifier,omitempty"`
	SecretTypes                        []string          `json:"secretTypes,omitempty"`
	SecretManagerIdentifiers           []string          `json:"secretManagerIdentifiers,omitempty"`
	Description                        string            `json:"description,omitempty"`
	SearchTerm                         string            `json:"searchTerm,omitempty"`
	IncludeSecretsFromEverySubScope    bool              `json:"includeSecretsFromEverySubScope,omitempty"`
	IncludeAllSecretsAccessibleAtScope bool              `json:"includeAllSecretsAccessibleAtScope,omitempty"`
	Tags                               map[string]string `json:"tags,omitempty"`
	Labels                             map[string]string `json:"labels,omitempty"`
	FilterType                         string            `json:"filterType,omitempty"`
}
