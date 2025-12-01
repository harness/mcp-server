package dto

// Workspace represents an IaCM workspace
type Workspace struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Status      string            `json:"status"`
	LastRun     string            `json:"last_run,omitempty"`
	Variables   map[string]string `json:"variables,omitempty"`
	CostSummary *CostSummary      `json:"cost_summary,omitempty"`
	ProjectID   string            `json:"project_id"`
	OrdId       string            `json:"ord_id"`
}

type CostSummary struct {
	TotalCost float64 `json:"total_cost"`
	Currency  string  `json:"currency"`
}

// WorkspaceListOptions for filtering/pagination
type WorkspaceListOptions struct {
	PaginationOptions
	Status    string `json:"status,omitempty"`
	ProjectID string `json:"project_id,omitempty"`
	OrgID     string `json:"org_id,omitempty"`
}

type Resource struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Type        string            `json:"type"`
	Provider    string            `json:"provider"`
	Module      string            `json:"module,omitempty"`
	DriftStatus string            `json:"drift_status,omitempty"`
	CostData    *ResourceCost     `json:"cost_data,omitempty"`
	Attributes  map[string]string `json:"attributes,omitempty"`
}

type ResourceCost struct {
	MonthlyCost float64 `json:"monthly_cost"`
	Currency    string  `json:"currency"`
}

type ResourceListOptions struct {
	PaginationOptions
	Provider string `url:"provider,omitempty"`
	Type     string `url:"type,omitempty"`
	Module   string `url:"module,omitempty"`
}

// Module represents an IaCM module
type Module struct {
	ID              string   `json:"id"`
	Name            string   `json:"name"`
	SourceRepo      string   `json:"source_repo"`
	Version         string   `json:"version"`
	Provider        string   `json:"provider"`
	InvocationCount int      `json:"invocation_count"`
	Tags            []string `json:"tags,omitempty"`
}

type ModuleListOptions struct {
	PaginationOptions
	Tag      string `json:"tag,omitempty"`
	Version  string `json:"version,omitempty"`
	Provider string `json:"provider,omitempty"`
}
