package dto

// FMEWorkspace represents a workspace in FME (Feature Management Engine)
type FMEWorkspace struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

// FMEEnvironment represents an environment within a workspace
type FMEEnvironment struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Type string `json:"type"`
}

// FMEFeatureFlag represents a feature flag in FME
type FMEFeatureFlag struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Description   string `json:"description"`
	RolloutStatus string `json:"rolloutStatus"`
	CreationTime  int64  `json:"creationTime,omitempty"`
	Tags          []string `json:"tags,omitempty"`
}

// FMEFeatureFlagRollout represents the complete rollout configuration for a feature flag
type FMEFeatureFlagRollout struct {
	Name             string             `json:"name"`
	Environment      string             `json:"environment"`
	RolloutStatus    string             `json:"rolloutStatus"`
	Treatments       []FMETreatment     `json:"treatments"`
	TargetingRules   []FMETargetingRule `json:"targetingRules"`
	DefaultTreatment string             `json:"defaultTreatment"`
	LastUpdated      string             `json:"lastUpdated,omitempty"`
	TrafficType      string             `json:"trafficType,omitempty"`
	Killed           bool               `json:"killed,omitempty"`
}

// FMETreatment represents a treatment (variation) of a feature flag
type FMETreatment struct {
	Name          string                 `json:"name"`
	Configuration map[string]interface{} `json:"configuration"`
	Percentage    float64                `json:"percentage,omitempty"`
	Description   string                 `json:"description,omitempty"`
}

// FMETargetingRule represents a targeting rule for a feature flag
type FMETargetingRule struct {
	Condition   string  `json:"condition"`
	Treatment   string  `json:"treatment"`
	Percentage  float64 `json:"percentage,omitempty"`
	BucketBy    string  `json:"bucketBy,omitempty"`
	Rollout     bool    `json:"rollout,omitempty"`
}

// FMEWorkspaceListResponse represents the API response for listing workspaces
type FMEWorkspaceListResponse struct {
	Objects    []FMEWorkspace `json:"objects"`
	Offset     int            `json:"offset"`
	Limit      int            `json:"limit"`
	TotalCount int            `json:"totalCount"`
}

// FMEFeatureFlagListResponse represents the API response for listing feature flags
type FMEFeatureFlagListResponse struct {
	Objects    []FMEFeatureFlag `json:"objects"`
	Offset     int              `json:"offset"`
	Limit      int              `json:"limit"`
	TotalCount int              `json:"totalCount"`
}