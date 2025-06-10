package dto

// Environment represents a Harness environment
type Environment struct {
	ID                string                 `json:"identifier"`
	Name              string                 `json:"name"`
	Description       string                 `json:"description,omitempty"`
	OrgIdentifier     string                 `json:"orgIdentifier"`
	ProjectIdentifier string                 `json:"projectIdentifier"`
	Color             string                 `json:"color,omitempty"`
	Type              string                 `json:"type,omitempty"` // e.g., "PreProduction", "Production"
	Tags              map[string]string      `json:"tags,omitempty"`
	YAML              string                 `json:"yaml,omitempty"`
	Variables         []map[string]interface{} `json:"variables,omitempty"`
	GitOpsEnabled     bool                   `json:"gitOpsEnabled,omitempty"`
	CreatedAt         int64                  `json:"createdAt,omitempty"`
	LastModifiedAt    int64                  `json:"lastModifiedAt,omitempty"`
}

// EnvironmentResponse represents the response from the get environment API
type EnvironmentResponse struct {
	Data Environment `json:"data"`
}

// EnvironmentListResponse represents the response from the list environments API
type EnvironmentListResponse struct {
	Data struct {
		Content       []Environment `json:"content"`
		TotalPages    int           `json:"totalPages"`
		TotalElements int           `json:"totalElements"`
		PageSize      int           `json:"pageSize"`
		PageIndex     int           `json:"pageIndex"`
	} `json:"data"`
}

// EnvironmentOptions represents the options for listing environments
type EnvironmentOptions struct {
	Page  int    `json:"page,omitempty"` 
	Limit int    `json:"limit,omitempty"`
	Sort  string `json:"sort,omitempty"`
	Order string `json:"order,omitempty"`
}

// MoveEnvironmentConfigsRequest represents the request body for moving environment configurations
type MoveEnvironmentConfigsRequest struct {
	SourceEnvironmentRef EnvironmentRef    `json:"sourceEnvironmentRef"`
	TargetEnvironmentRef EnvironmentRef    `json:"targetEnvironmentRef"`
	ConfigTypes          []string          `json:"configTypes"`
	ServiceRefs          []ServiceRef      `json:"serviceRefs,omitempty"`
	InfrastructureRefs   []InfrastructureRef `json:"infrastructureRefs,omitempty"`
}

// EnvironmentRef represents an environment reference
type EnvironmentRef struct {
	OrgIdentifier     string `json:"orgIdentifier"`
	ProjectIdentifier string `json:"projectIdentifier"`
	Identifier        string `json:"identifier"`
}

// ServiceRef represents a service reference
type ServiceRef struct {
	OrgIdentifier     string `json:"orgIdentifier"`
	ProjectIdentifier string `json:"projectIdentifier"`
	Identifier        string `json:"identifier"`
}

// InfrastructureRef represents an infrastructure reference
type InfrastructureRef struct {
	OrgIdentifier     string `json:"orgIdentifier"`
	ProjectIdentifier string `json:"projectIdentifier"`
	Identifier        string `json:"identifier"`
}

// MoveEnvironmentConfigsResponse represents the response from move environment configs API
type MoveEnvironmentConfigsResponse struct {
	Data struct {
		Success bool `json:"success"`
	} `json:"data"`
}
