package dto

type CCMListRecommendationsOptions struct {
	K8sRecommendationFilterPropertiesDTO      CCMK8sRecommendationFilterPropertiesDTO      `json:"k8sRecommendationFilterPropertiesDTO,omitempty"`
	AwsRecommendationFilterPropertiesDTO      CCMAwsRecommendationFilterPropertiesDTO      `json:"awsRecommendationFilterPropertiesDTO,omitempty"`
	AzureRecommendationFilterProperties       CCMAzureRecommendationFilterProperties       `json:"azureRecommendationFilterProperties,omitempty"`
	ContainerRecommendationFilterPropertiesDTO CCMContainerRecommendationFilterPropertiesDTO `json:"containerRecommendationFilterPropertiesDTO,omitempty"`
	GovernanceRecommendationFilterPropertiesDTO CCMGovernanceRecommendationFilterPropertiesDTO `json:"governanceRecommendationFilterPropertiesDTO,omitempty"`
	BaseRecommendationFilterPropertiesDTO     CCMBaseRecommendationFilterPropertiesDTO     `json:"baseRecommendationFilterPropertiesDTO,omitempty"`
	PerspectiveFilters                        []CCMPerspectiveFilter                      `json:"perspectiveFilters,omitempty"`
	MinSaving                                 int                                         `json:"minSaving,omitempty"`
	MinCost                                   int                                         `json:"minCost,omitempty"`
	DaysBack                                  int                                         `json:"daysBack,omitempty"`
	Offset                                    int                                         `json:"offset,omitempty"`
	Limit                                     int                                         `json:"limit,omitempty"`
	ChildRecommendation                       bool                                        `json:"childRecommendation,omitempty"`
	IncludeIgnoredRecommendation              bool                                        `json:"includeIgnoredRecommendation,omitempty"`
	ParentRecommendation                      bool                                        `json:"parentRecommendation,omitempty"`
	TagDTOs                                   []CCMTagDTO                                 `json:"tagDTOs,omitempty"`
	CostCategoryDTOs                          []CCMCostCategoryDTO                        `json:"costCategoryDTOs,omitempty"`
	Tags                                      map[string]string                           `json:"tags,omitempty"`
	FilterType                                string                                      `json:"filterType,omitempty"`
}

type CCMK8sRecommendationFilterPropertiesDTO struct {
	IDs                 []string `json:"ids,omitempty"`
	Names               []string `json:"names,omitempty"`
	Namespaces          []string `json:"namespaces,omitempty"`
	ClusterNames        []string `json:"clusterNames,omitempty"`
	ResourceTypes       []string `json:"resourceTypes,omitempty"`
	RecommendationStates []string `json:"recommendationStates,omitempty"`
	CloudProvider       []string `json:"cloudProvider,omitempty"`
	Regions             []string `json:"regions,omitempty"`
}

type CCMAwsRecommendationFilterPropertiesDTO struct {
	InstanceType []string `json:"instanceType,omitempty"`
}

type CCMAzureRecommendationFilterProperties struct {
	InstanceType  []string `json:"instanceType,omitempty"`
	ResourceGroup []string `json:"resourceGroup,omitempty"`
}

type CCMContainerRecommendationFilterPropertiesDTO struct {
	K8sClusterName  []string `json:"k8sClusterName,omitempty"`
	K8sNamespace    []string `json:"k8sNamespace,omitempty"`
	EcsClusterName  []string `json:"ecsClusterName,omitempty"`
	EcsLaunchType   []string `json:"ecsLaunchType,omitempty"`
}

type CCMGovernanceRecommendationFilterPropertiesDTO struct {
	GovernanceRuleName []string `json:"governanceRuleName,omitempty"`
}

type CCMBaseRecommendationFilterPropertiesDTO struct {
	ID                 []string `json:"id,omitempty"`
	CloudAccountId     []string `json:"cloudAccountId,omitempty"`
	CloudAccountName   []string `json:"cloudAccountName,omitempty"`
	ResourceId         []string `json:"resourceId,omitempty"`
	ResourceName       []string `json:"resourceName,omitempty"`
	Region             []string `json:"region,omitempty"`
	ResourceType       []string `json:"resourceType,omitempty"`
	RecommendationState []string `json:"recommendationState,omitempty"`
	CloudProvider      []string `json:"cloudProvider,omitempty"`
}

type CCMPerspectiveFilter struct {
	IDFilter              CCMIDFilter              `json:"idFilter,omitempty"`
	TimeFilter            CCMTimeFilter            `json:"timeFilter,omitempty"`
	TimeRangeTypeFilter   string                   `json:"timeRangeTypeFilter,omitempty"`
	ViewMetadataFilter    CCMViewMetadataFilter    `json:"viewMetadataFilter,omitempty"`
	RuleFilter            CCMRuleFilter            `json:"ruleFilter,omitempty"`
}

type CCMIDFilter struct {
	Field    CCMField   `json:"field,omitempty"`
	Operator string     `json:"operator,omitempty"`
	Values   []string   `json:"values,omitempty"`
}

type CCMTimeFilter struct {
	Field    CCMField   `json:"field,omitempty"`
	Operator string     `json:"operator,omitempty"`
	Value    int        `json:"value,omitempty"`
}

type CCMViewMetadataFilter struct {
	ViewId    string `json:"viewId,omitempty"`
	IsPreview bool   `json:"isPreview,omitempty"`
	Preview   bool   `json:"preview,omitempty"`
}

type CCMRuleFilter struct {
	Conditions []CCMCondition `json:"conditions,omitempty"`
}

type CCMCondition struct {
	Field    CCMField   `json:"field,omitempty"`
	Operator string     `json:"operator,omitempty"`
	Values   []string   `json:"values,omitempty"`
}

type CCMField struct {
	FieldId        string `json:"fieldId,omitempty"`
	FieldName      string `json:"fieldName,omitempty"`
	Identifier     string `json:"identifier,omitempty"`
	IdentifierName string `json:"identifierName,omitempty"`
}

type CCMTagDTO struct {
	Key   string `json:"key,omitempty"`
	Value string `json:"value,omitempty"`
}

type CCMCostCategoryDTO struct {
	CostCategory string `json:"costCategory,omitempty"`
	CostBucket   string `json:"costBucket,omitempty"`
}

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
	MonthlyCost            int                      `json:"monthlyCost,omitempty"`
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
