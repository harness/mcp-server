package dto

// Service represents a service in Harness
type Service struct {
	ID                string                   `json:"identifier"`
	Name              string                   `json:"name"`
	Description       string                   `json:"description,omitempty"`
	OrgIdentifier     string                   `json:"orgIdentifier"`
	ProjectIdentifier string                   `json:"projectIdentifier"`
	YAML              string                   `json:"yaml,omitempty"`
	Tags              map[string]string        `json:"tags,omitempty"`
	Variables         []map[string]interface{} `json:"variables,omitempty"`
	GitOpsEnabled     bool                     `json:"gitOpsEnabled,omitempty"`
	CreatedAt         int64                    `json:"createdAt,omitempty"`
	LastModifiedAt    int64                    `json:"lastModifiedAt,omitempty"`
}

// ServiceResponse represents the response from the get service API
type ServiceResponse struct {
	Data Service `json:"data"`
}

// ServiceListResponse represents the response from the list services API
type ServiceListResponse struct {
	Data struct {
		Content       []Service `json:"content"`
		TotalPages    int       `json:"totalPages"`
		TotalElements int       `json:"totalElements"`
		PageSize      int       `json:"pageSize"`
		PageIndex     int       `json:"pageIndex"`
	} `json:"data"`
}

// ServiceOptions represents the options for listing services
type ServiceOptions struct {
	Page  int    `json:"page,omitempty"`
	Limit int    `json:"limit,omitempty"`
	Sort  string `json:"sort,omitempty"`
	Order string `json:"order,omitempty"`
	// Additional filtering options can be added as needed
}
