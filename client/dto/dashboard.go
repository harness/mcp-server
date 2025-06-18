package dto

// Dashboard represents a Harness dashboard
type Dashboard struct {
	ID             string   `json:"id"`
	Title          string   `json:"title"`
	Description    string   `json:"description"`
	Models         []string `json:"models"`
	DataSource     []string `json:"data_source"`
	Type           string   `json:"type"`
	ViewCount      int      `json:"view_count"`
	FavoriteCount  int      `json:"favorite_count"`
	CreatedAt      string   `json:"created_at"`
	LastAccessedAt string   `json:"last_accessed_at"`
}

// DashboardListResponse represents the response from the list dashboards API
type DashboardListResponse struct {
	Items    int         `json:"items"`
	Pages    int         `json:"pages"`
	Resource []Dashboard `json:"resource"`
}

// DashboardListOptions represents options for listing dashboards
type DashboardListOptions struct {
	Page     int    `json:"page"`
	PageSize int    `json:"pageSize"`
	FolderID string `json:"folderId"`
	Tags     string `json:"tags"`
}

// DashboardData represents structured data from a dashboard
type DashboardData struct {
	Tables map[string][]map[string]string `json:"tables"`
}
