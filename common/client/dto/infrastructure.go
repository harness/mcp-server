package dto

// Infrastructure represents a Harness infrastructure definition
type Infrastructure struct {
	ID                string                   `json:"identifier"`
	Name              string                   `json:"name"`
	Description       string                   `json:"description,omitempty"`
	OrgIdentifier     string                   `json:"orgIdentifier"`
	ProjectIdentifier string                   `json:"projectIdentifier"`
	EnvironmentRef    string                   `json:"environmentRef"`
	Type              string                   `json:"type,omitempty"`
	DeploymentType    string                   `json:"deploymentType,omitempty"` // e.g., Kubernetes, ECS, etc.
	YAML              string                   `json:"yaml,omitempty"`
	Tags              map[string]string        `json:"tags,omitempty"`
	Variables         []map[string]interface{} `json:"variables,omitempty"`
	GitOpsEnabled     bool                     `json:"gitOpsEnabled,omitempty"`
	AccountID         string                   `json:"accountId,omitempty"`
	StoreType         string                   `json:"storeType,omitempty"`
}

// InfrastructureItem represents an item in the response list
type InfrastructureItem struct {
	Infrastructure        Infrastructure `json:"infrastructure"`
	CreatedAt             int64          `json:"createdAt,omitempty"`
	LastModifiedAt        int64          `json:"lastModifiedAt,omitempty"`
	EntityValidityDetails interface{}    `json:"entityValidityDetails"`
	GovernanceMetadata    interface{}    `json:"governanceMetadata"`
}

// InfrastructureListResponse represents the response from the list infrastructures API
type InfrastructureListResponse struct {
	Status        string      `json:"status,omitempty"`
	MetaData      interface{} `json:"metaData"`
	CorrelationID string      `json:"correlationId,omitempty"`
	Data          struct {
		Content       []InfrastructureItem `json:"content"`
		TotalPages    int                  `json:"totalPages"`
		TotalItems    int                  `json:"totalItems"`
		PageItemCount int                  `json:"pageItemCount"`
		PageSize      int                  `json:"pageSize"`
		PageIndex     int                  `json:"pageIndex"`
		Empty         bool                 `json:"empty"`
		PageToken     interface{}          `json:"pageToken"`
	} `json:"data"`
}

// InfrastructureOptions represents the options for listing infrastructures
type InfrastructureOptions struct {
	Page                  int    `json:"page,omitempty"`
	Limit                 int    `json:"limit,omitempty"`
	Sort                  string `json:"sort,omitempty"`
	Order                 string `json:"order,omitempty"`
	DeploymentType        string `json:"deploymentType,omitempty"`        // Filter by deployment type
	EnvironmentIdentifier string `json:"environmentIdentifier,omitempty"` // Filter by environment
}

// MoveInfraConfigsRequest represents the request to move infrastructure configurations
type MoveInfraConfigsRequest struct {
	InfraIdentifier       string         `json:"-"` // Required - from path parameter
	EnvironmentIdentifier string         `json:"-"` // Required
	AccountIdentifier     string         `json:"-"` // Required
	OrgIdentifier         string         `json:"-"`
	ProjectIdentifier     string         `json:"-"`
	ConnectorRef          string         `json:"-"`
	RepoName              string         `json:"-"`
	Branch                string         `json:"-"`
	FilePath              string         `json:"-"`
	CommitMsg             string         `json:"-"`
	IsNewBranch           *bool          `json:"-"`
	BaseBranch            string         `json:"-"`
	IsHarnessCodeRepo     *bool          `json:"-"`
	MoveConfigType        MoveConfigType `json:"-"` // Required - enum: "INLINE_TO_REMOTE" "REMOTE_TO_INLINE"
}

// MoveInfraConfigsResponse represents the response from the move infrastructure configs API
type MoveInfraConfigsResponse struct {
	Status        string `json:"status"`
	CorrelationId string `json:"correlationId"`
	MetaData      any    `json:"metaData"`

	Data struct {
		Identifier string `json:"identifier"`
		Success    bool   `json:"success"`
	} `json:"data,omitempty"`

	Code             string                `json:"code,omitempty"`
	Message          string                `json:"message,omitempty"`
	DetailedMessage  string                `json:"detailedMessage,omitempty"`
	ResponseMessages []HarnessErrorMessage `json:"responseMessages,omitempty"`
}
