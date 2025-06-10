package dto

// Infrastructure represents a Harness infrastructure definition
type Infrastructure struct {
	ID                string                 `json:"identifier"`
	Name              string                 `json:"name"`
	Description       string                 `json:"description,omitempty"`
	OrgIdentifier     string                 `json:"orgIdentifier"`
	ProjectIdentifier string                 `json:"projectIdentifier"`
	EnvironmentRef    string                 `json:"environmentRef"`
	Type              string                 `json:"type,omitempty"`
	Deployment        string                 `json:"deployment,omitempty"` // e.g., Kubernetes, ECS, etc.
	YAML              string                 `json:"yaml,omitempty"`
	Tags              map[string]string      `json:"tags,omitempty"`
	Variables         []map[string]interface{} `json:"variables,omitempty"`
	GitOpsEnabled     bool                   `json:"gitOpsEnabled,omitempty"`
	CreatedAt         int64                  `json:"createdAt,omitempty"`
	LastModifiedAt    int64                  `json:"lastModifiedAt,omitempty"`
}

// InfrastructureListResponse represents the response from the list infrastructures API
type InfrastructureListResponse struct {
	Data struct {
		Content       []Infrastructure `json:"content"`
		TotalPages    int              `json:"totalPages"`
		TotalElements int              `json:"totalElements"`
		PageSize      int              `json:"pageSize"`
		PageIndex     int              `json:"pageIndex"`
	} `json:"data"`
}

// InfrastructureOptions represents the options for listing infrastructures
type InfrastructureOptions struct {
	Page         int    `json:"page,omitempty"`
	Limit        int    `json:"limit,omitempty"`
	Sort         string `json:"sort,omitempty"`
	Order        string `json:"order,omitempty"`
	Type         string `json:"type,omitempty"` // Filter by infrastructure type
	Deployment   string `json:"deployment,omitempty"` // Filter by deployment type
	Environment  string `json:"environment,omitempty"` // Filter by environment
}

// MoveInfraConfigsRequest represents the request to move infrastructure configurations
type MoveInfraConfigsRequest struct {
	SourceInfrastructureRef InfrastructureRef `json:"sourceInfrastructureRef"`
	TargetInfrastructureRef InfrastructureRef `json:"targetInfrastructureRef"`
	ConfigTypes             []string          `json:"configTypes"`
	ServiceRefs             []ServiceRef      `json:"serviceRefs,omitempty"`
}

// MoveInfraConfigsResponse represents the response from the move infrastructure configs API
type MoveInfraConfigsResponse struct {
	Data struct {
		Success bool `json:"success"`
	} `json:"data"`
}
