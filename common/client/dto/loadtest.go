package dto

// ListLoadTestResponse represents the response from listing load tests
type ListLoadTestResponse []LoadTest

// LoadTest represents a load test entity
type LoadTest struct {
	ID                 string            `json:"id"`
	Name               string            `json:"name"`
	Description        string            `json:"description"`
	Tags               []string          `json:"tags"`
	AccountID          string            `json:"accountId"`
	OrgID              string            `json:"orgId"`
	ProjectID          string            `json:"projectId"`
	LocustCluster      *LocustCluster    `json:"locustCluster,omitempty"`
	TargetURL          string            `json:"targetUrl"`
	ScriptContent      string            `json:"scriptContent,omitempty"`
	IsAPIGenerated     bool              `json:"isApiGenerated"`
	IsSampleTest       bool              `json:"isSampleTest"`
	JSONScript         string            `json:"jsonScript,omitempty"`
	JSONSpecData       *LoadTestJSONSpec `json:"jsonSpecData,omitempty"`
	LatestRevisionID   string            `json:"latestRevisionId"`
	DefaultUsers       int               `json:"defaultUsers"`
	DefaultSpawnRate   int               `json:"defaultSpawnRate"`
	DefaultDurationSec int               `json:"defaultDurationSec"`
	MaxDurationSec     int               `json:"maxDurationSec"`
	RecentRuns         []LoadTestRun     `json:"recentRuns,omitempty"`
	CreatedAt          string            `json:"createdAt"`
	CreatedBy          string            `json:"createdBy"`
	UpdatedAt          string            `json:"updatedAt"`
	UpdatedBy          string            `json:"updatedBy"`
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

// LoadTestJSONSpec represents the JSON specification for a load test
type LoadTestJSONSpec struct {
	Config    *LoadTestConfig    `json:"config,omitempty"`
	Endpoints []LoadTestEndpoint `json:"endpoints,omitempty"`
}

// LoadTestConfig represents the configuration section of a load test spec
type LoadTestConfig struct {
	Host string `json:"host"`
}

// LoadTestEndpoint represents an endpoint in the load test specification
type LoadTestEndpoint struct {
	Name        string                 `json:"name"`
	Method      string                 `json:"method"`
	Path        string                 `json:"path"`
	Headers     map[string]string      `json:"headers,omitempty"`
	QueryParams map[string]string      `json:"query_params,omitempty"`
	Body        map[string]interface{} `json:"body,omitempty"`
	Assertions  *EndpointAssertions    `json:"assertions,omitempty"`
}

// EndpointAssertions represents the assertions for an endpoint
type EndpointAssertions struct {
	StatusCode int `json:"status_code"`
}
