package dto

const (
	RecommendationStateApplied = "APPLIED"
	RecommendationStateOpen    = "OPEN"
	RecommendationStateIgnored = "IGNORED"
)

const (
	ResourceTypeWorkload      = "WORKLOAD"
	ResourceTypeNodePool      = "NODE_POOL"
	ResourceTypeECSService    = "ECS_SERVICE"
	ResourceTypeEC2Instance   = "EC2_INSTANCE"
	ResourceTypeGovernance    = "GOVERNANCE"
	ResourceTypeAzureInstance = "AZURE_INSTANCE"
)

type CCMJiraDetails struct {
	RecommendationId string                 `json:"recommendationId"`
	ResourceType     string                 `json:"resourceType"`
	ConnectorRef     string                 `json:"connectorRef"`
	ProjectKey       string                 `json:"projectKey,omitempty"`
	TicketType        string                 `json:"ticketType"`
	Fields           map[string]any `json:"fields"`
}
