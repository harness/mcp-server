package dto

// ListLoadTestResponse represents the response from listing load tests
type ListLoadTestResponse []LoadTest

// LoadTest represents a load test entity
type LoadTest struct {
	ID                 string         `json:"id"`
	Name               string         `json:"name"`
	Description        string         `json:"description"`
	Tags               []string       `json:"tags"`
	AccountID          string         `json:"accountId"`
	OrgID              string         `json:"orgId"`
	ProjectID          string         `json:"projectId"`
	LocustCluster      *LocustCluster `json:"locustCluster,omitempty"`
	TargetURL          string         `json:"targetUrl"`
	IsAPIGenerated     bool           `json:"isApiGenerated"`
	IsSampleTest       bool           `json:"isSampleTest"`
	LatestRevisionID   string         `json:"latestRevisionId"`
	DefaultUsers       int            `json:"defaultUsers"`
	DefaultSpawnRate   int            `json:"defaultSpawnRate"`
	DefaultDurationSec int            `json:"defaultDurationSec"`
	MaxDurationSec     int            `json:"maxDurationSec"`
	RecentRuns         []LoadTestRun  `json:"recentRuns,omitempty"`
	CreatedAt          string         `json:"createdAt"`
	CreatedBy          string         `json:"createdBy"`
	UpdatedAt          string         `json:"updatedAt"`
	UpdatedBy          string         `json:"updatedBy"`
}

// LocustCluster represents the load runner cluster configuration
type LocustCluster struct {
	ID      string `json:"id"`
	BaseURL string `json:"baseUrl"`
}

// LoadTestRun represents a single run of a load test
type LoadTestRun struct {
	ID              string `json:"id"`
	Status          string `json:"status"`
	TargetUsers     int    `json:"targetUsers"`
	SpawnRate       int    `json:"spawnRate"`
	DurationSeconds int    `json:"durationSeconds"`
	StartedAt       string `json:"startedAt"`
	CreatedAt       string `json:"createdAt"`
	CreatedBy       string `json:"createdBy"`
}

