package dto

type CCMListRecommendationsResponse struct {
	CCMBaseResponse
	Data          CCMRecommendationsResponseData `json:"data,omitempty"`
}

type CCMRecommendationsResponseData struct {
	Items  []CCMRecommendationItem `json:"items,omitempty"`
	Offset int                     `json:"offset,omitempty"`
	Limit  int                     `json:"limit,omitempty"`
}

type CCMRecommendationItem struct {
	ID                     string                   `json:"id,omitempty"`
	ClusterName            string                   `json:"clusterName,omitempty"`
	Namespace              string                   `json:"namespace,omitempty"`
	ResourceName           string                   `json:"resourceName,omitempty"`
	MonthlySaving          float64                      `json:"monthlySaving,omitempty"`
	PreferenceBasedSaving  int                      `json:"preferenceBasedSaving,omitempty"`
	MonthlyCost            float64                      `json:"monthlyCost,omitempty"`
	IsValid                bool                     `json:"isValid,omitempty"`
	LastProcessedAt        int                      `json:"lastProcessedAt,omitempty"`
	ResourceType           string                   `json:"resourceType,omitempty"`
	RecommendationState    string                   `json:"recommendationState,omitempty"`
	JiraConnectorRef       string                   `json:"jiraConnectorRef,omitempty"`
	JiraIssueKey           string                   `json:"jiraIssueKey,omitempty"`
	JiraStatus             string                   `json:"jiraStatus,omitempty"`
	ServicenowConnectorRef string                   `json:"servicenowConnectorRef,omitempty"`
	ServicenowIssueKey     string                   `json:"servicenowIssueKey,omitempty"`
	ServicenowIssueStatus  string                   `json:"servicenowIssueStatus,omitempty"`
	RecommendationDetails  map[string]any           `json:"recommendationDetails,omitempty"`
	PerspectiveId          string                   `json:"perspectiveId,omitempty"`
	PerspectiveName        string                   `json:"perspectiveName,omitempty"`
	CloudProvider          string                   `json:"cloudProvider,omitempty"`
	GovernanceRuleId       string                   `json:"governanceRuleId,omitempty"`
	TargetRegion           string                   `json:"targetRegion,omitempty"`
	AppliedAt              int                      `json:"appliedAt,omitempty"`
	AppliedAtSavings       int                      `json:"appliedAtSavings,omitempty"`
	OverriddenSavings      int                      `json:"overriddenSavings,omitempty"`
	CostCategoryDetails    []CCMCostCategoryDetail  `json:"costCategoryDetails,omitempty"`
}

type CCMCostCategoryDetail struct {
	CostCategory string `json:"costCategory,omitempty"`
	CostBucket   string `json:"costBucket,omitempty"`
}
