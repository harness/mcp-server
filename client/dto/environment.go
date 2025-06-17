package dto

// Environment represents a Harness environment
type Environment struct {
	ID                string                   `json:"identifier"`
	Name              string                   `json:"name"`
	Description       string                   `json:"description,omitempty"`
	OrgIdentifier     string                   `json:"orgIdentifier"`
	ProjectIdentifier string                   `json:"projectIdentifier"`
	Color             string                   `json:"color,omitempty"`
	Type              string                   `json:"type,omitempty"` // e.g., "PreProduction", "Production"
	Tags              map[string]string        `json:"tags,omitempty"`
	YAML              string                   `json:"yaml,omitempty"`
	Variables         []map[string]interface{} `json:"variables,omitempty"`
	GitOpsEnabled     bool                     `json:"gitOpsEnabled,omitempty"`
	CreatedAt         int64                    `json:"createdAt,omitempty"`
	LastModifiedAt    int64                    `json:"lastModifiedAt,omitempty"`
}

// EnvironmentResponse represents the response from the get environment API
type EnvironmentResponse struct {
	Data Environment `json:"data"`
}

// EnvironmentListResponse represents the response from the list environments API
type EnvironmentListResponse struct {
	Data struct {
		Content       []Environment `json:"content"`
		TotalPages    int           `json:"totalPages"`
		TotalElements int           `json:"totalElements"`
		PageSize      int           `json:"pageSize"`
		PageIndex     int           `json:"pageIndex"`
	} `json:"data"`
}

// EnvironmentOptions represents the options for listing environments
type EnvironmentOptions struct {
	Page  int    `json:"page,omitempty"`
	Limit int    `json:"limit,omitempty"`
	Sort  string `json:"sort,omitempty"`
	Order string `json:"order,omitempty"`
}

type MoveConfigType string

const (
	InlineToRemote MoveConfigType = "INLINE_TO_REMOTE"
	RemoteToInline MoveConfigType = "REMOTE_TO_INLINE"
)

type MoveEnvironmentConfigsRequest struct {
	EnvironmentIdentifier string `json:"-"` // Not part of the body but needed for the path

	AccountIdentifier string         `json:"-"` // Required
	OrgIdentifier     string         `json:"-"`
	ProjectIdentifier string         `json:"-"`
	ConnectorRef      string         `json:"-"`
	RepoName          string         `json:"-"`
	Branch            string         `json:"-"`
	FilePath          string         `json:"-"`
	CommitMsg         string         `json:"-"`
	IsNewBranch       *bool          `json:"-"`
	BaseBranch        string         `json:"-"`
	IsHarnessCodeRepo *bool          `json:"-"`
	MoveConfigType    MoveConfigType `json:"-"` // Required
}
type HarnessErrorMessage struct {
	Code           string                 `json:"code"`
	Level          string                 `json:"level"`
	Message        string                 `json:"message"`
	Exception      interface{}            `json:"exception"`
	FailureTypes   []string               `json:"failureTypes"`
	AdditionalInfo map[string]interface{} `json:"additionalInfo"`
}

type MoveEnvironmentConfigsResponse struct {
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
