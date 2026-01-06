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

// Values received from the settings API
const (
	TicketPlatformJira       = "Jira"
	TicketPlatformServiceNow = "Servicenow"
)

type CCMTicketDetails struct {
	RecommendationId string         `json:"recommendationId"`
	ResourceType     string         `json:"resourceType"`
	ConnectorRef     string         `json:"connectorRef"`
	ProjectKey       string         `json:"projectKey,omitempty"`
	TicketType       string         `json:"ticketType"`
	Fields           map[string]any `json:"fields"`
	Platform         string         // TicketPlatform
}

type CCMRecommendationDetailOptions struct {
	AccountIdentifier string `json:"accountIdentifier"`
	RecommendationId  string `json:"id"`
	From              string `json:"from,omitempty"`
	To                string `json:"to,omitempty"`
	BufferPercentage  int64  `json:"bufferPercentage,omitempty"` // Only for ECS Service recommendations
}

type CCMTicketToolSettings struct {
	Setting        CCMTicketToolSetting `json:"setting"`
	LastModifiedAt int64                `json:"lastModifiedAt"`
}

type CCMTicketToolSetting struct {
	Identifier        string    `json:"identifier"`
	Name              string    `json:"name"`
	OrgIdentifier     *string   `json:"orgIdentifier"`
	ProjectIdentifier *string   `json:"projectIdentifier"`
	Category          string    `json:"category"`
	GroupIdentifier   string    `json:"groupIdentifier"`
	ValueType         string    `json:"valueType"`
	AllowedValues     *[]string `json:"allowedValues"`
	AllowOverrides    bool      `json:"allowOverrides"`
	Value             string    `json:"value"`
	DefaultValue      *string   `json:"defaultValue"`
	SettingSource     string    `json:"settingSource"`
	IsSettingEditable bool      `json:"isSettingEditable"`
	AllowedScopes     []string  `json:"allowedScopes"`
}

type CCMTicketToolSettingsResponse struct {
	CCMBaseResponse
	Data []CCMTicketToolSettings `json:"data,omitempty"`
}

type CCMJiraIssueTypesOptions struct {
	AccountId    string
	ProjectKey   string
	ConnectorRef string
}

type CCMJiraIssueTypesResponse struct {
	CCMBaseResponse
	Data CCMJiraProjects `json:"data,omitempty"`
}

type CCMJiraProjects struct {
	Projects map[string]CCMJiraProjectDetail `json:"projects"`
}

type CCMJiraProjectDetail struct {
	Id         string                      `json:"id"`
	Key        string                      `json:"key"`
	Name       string                      `json:"name"`
	IssueTypes map[string]CCMJiraIssueType `json:"issuetypes"`
}

type CCMJiraIssueType struct {
	Id   string `json:"id"`
	Name string `json:"name"`
}

type CCMIssueTypeInfo struct {
	Id   string `json:"id"`
	Name string `json:"name"`
}

type CCMJiraIssueTypesList struct {
	CCMBaseResponse
	Data []CCMJiraIssueType `json:"data,omitempty"`
}
