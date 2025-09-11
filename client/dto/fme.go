package dto

// FME (Feature Management and Experimentation) DTOs for Split.io APIs
// Based on actual API response examples from Split.io

// FMEWorkspace represents a workspace in Split.io
type FMEWorkspace struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// FMEWorkspacesResponse represents the response from listing workspaces
// GET /internal/api/v2/workspaces
type FMEWorkspacesResponse struct {
	Objects    []FMEWorkspace `json:"objects"`
	Offset     int            `json:"offset"`
	Limit      int            `json:"limit"`
	TotalCount int            `json:"totalCount"`
}

// FMEEnvironment represents an environment in Split.io
type FMEEnvironment struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// FMEEnvironmentsResponse represents the response from listing environments
// GET /internal/api/v2/environments/ws/{wsId}
// Note: This endpoint returns a simple array, not a paginated object
type FMEEnvironmentsResponse []FMEEnvironment

// FMETrafficType represents a traffic type in Split.io
type FMETrafficType struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// FMETag represents a tag in Split.io
type FMETag struct {
	Name string `json:"name"`
}

// FMERolloutStatus represents the rollout status of a feature flag
type FMERolloutStatus struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// FMEFeatureFlag represents a feature flag (split) in Split.io
type FMEFeatureFlag struct {
	Name                    string           `json:"name"`
	Description             string           `json:"description"`
	ID                      string           `json:"id"`
	TrafficType             FMETrafficType   `json:"trafficType"`
	CreationTime            int64            `json:"creationTime"`
	Tags                    []FMETag         `json:"tags"`
	RolloutStatus           FMERolloutStatus `json:"rolloutStatus"`
	RolloutStatusTimestamp  int64            `json:"rolloutStatusTimestamp"`
}

// FMEFeatureFlagsResponse represents the response from listing feature flags
// GET /internal/api/v2/splits/ws/{wsId}
type FMEFeatureFlagsResponse struct {
	Objects    []FMEFeatureFlag `json:"objects"`
	Offset     int              `json:"offset"`
	Limit      int              `json:"limit"`
	TotalCount int              `json:"totalCount"`
}

// FMETreatment represents a treatment (variation) in a feature flag
type FMETreatment struct {
	Name           string `json:"name"`
	Configurations string `json:"configurations"`
}

// FMEBucket represents a bucket in a rule
type FMEBucket struct {
	Treatment string `json:"treatment"`
	Size      int    `json:"size"`
}

// FMEMatcher represents a matcher in a rule condition
type FMEMatcher struct {
	Type   string `json:"type"`
	String string `json:"string"`
}

// FMECondition represents a condition in a rule
type FMECondition struct {
	Combiner string       `json:"combiner"`
	Matchers []FMEMatcher `json:"matchers"`
}

// FMERule represents a targeting rule in a feature flag
type FMERule struct {
	Buckets   []FMEBucket  `json:"buckets"`
	Condition FMECondition `json:"condition"`
}

// FMEDefaultRule represents a default rule bucket
type FMEDefaultRule struct {
	Treatment string `json:"treatment"`
	Size      int    `json:"size"`
}

// FMEFeatureFlagDefinition represents the complete definition of a feature flag in an environment
type FMEFeatureFlagDefinition struct {
	Name                    string               `json:"name"`
	Environment             FMEEnvironment       `json:"environment"`
	TrafficType             FMETrafficType       `json:"trafficType"`
	Killed                  bool                 `json:"killed"`
	LastTrafficReceivedAt   int64                `json:"lastTrafficReceivedAt"`
	Treatments              []FMETreatment       `json:"treatments"`
	DefaultTreatment        string               `json:"defaultTreatment"`
	BaselineTreatment       string               `json:"baselineTreatment"`
	TrafficAllocation       int                  `json:"trafficAllocation"`
	Rules                   []FMERule            `json:"rules"`
	DefaultRule             []FMEDefaultRule     `json:"defaultRule"`
	CreationTime            int64                `json:"creationTime"`
	LastUpdateTime          int64                `json:"lastUpdateTime"`
}

// FMEFeatureFlagDefinitionResponse represents the response from getting a feature flag definition
// GET /internal/api/v2/splits/ws/{wsId}/{feature_flag_name}/environments/{environment_id_or_name}
// Note: This endpoint returns the definition object directly, not wrapped
type FMEFeatureFlagDefinitionResponse = FMEFeatureFlagDefinition