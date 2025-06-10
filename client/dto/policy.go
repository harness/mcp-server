package dto

// DashboardMetrics represents the dashboard metrics response from the policy API
type DashboardMetrics struct {
	Data interface{} `json:"data"` // Using interface{} since the structure can vary based on policy metrics
}

// Evaluation represents a policy evaluation instance
type Evaluation struct {
	ID                string                 `json:"identifier"`
	Name              string                 `json:"name"`
	Description       string                 `json:"description,omitempty"`
	Status            string                 `json:"status"`
	Result            string                 `json:"result,omitempty"`
	CreatedAt         int64                  `json:"createdAt"`
	LastModifiedAt    int64                  `json:"lastModifiedAt,omitempty"`
	OrgIdentifier     string                 `json:"orgIdentifier"`
	ProjectIdentifier string                 `json:"projectIdentifier"`
	AdditionalInfo    map[string]interface{} `json:"additionalInfo,omitempty"`
	EntityType        string                 `json:"entityType,omitempty"`
	EntityIdentifier  string                 `json:"entityIdentifier,omitempty"`
}

// EvaluationListResponse represents the response from the evaluations list API
type EvaluationListResponse struct {
	Data struct {
		Content       []Evaluation `json:"content"`
		TotalElements int          `json:"totalElements"`
		TotalPages    int          `json:"totalPages"`
		PageSize      int          `json:"pageSize"`
		PageIndex     int          `json:"pageIndex"`
	} `json:"data"`
}

// PolicyOptions represents the options for listing policy evaluations
type PolicyOptions struct {
	Page      int    `json:"page,omitempty"`
	Limit     int    `json:"limit,omitempty"`
	Sort      string `json:"sort,omitempty"`
	Order     string `json:"order,omitempty"`
	Status    string `json:"status,omitempty"`    // e.g. PASSED, FAILED, etc.
	Result    string `json:"result,omitempty"`    // filter by evaluation result
	StartTime int64  `json:"startTime,omitempty"` // filter by evaluation time range
	EndTime   int64  `json:"endTime,omitempty"`   // filter by evaluation time range
}
