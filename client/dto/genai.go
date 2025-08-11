package dto

type ContextType string

const (
	ContextTypeOther ContextType = "other"
)

type Capability struct {
	Type    string `json:"type"`
	Version string `json:"version"`
}

type ContextItem struct {
	Type    ContextType `json:"type"`
	Payload any         `json:"payload"`
}

type HarnessContext struct {
	OrgID     string `json:"org_id"`
	ProjectID string `json:"project_id"`
	AccountID string `json:"account_id"`
}

// RequestAction defines the set of valid actions that can be performed by the genai service
type RequestAction string

// Constants for the various action types
const (
	CreateStep      RequestAction = "CREATE_STEP"
	UpdateStep      RequestAction = "UPDATE_STEP"
	CreateStage     RequestAction = "CREATE_STAGE"
	UpdateStage     RequestAction = "UPDATE_STAGE"
	CreatePipeline  RequestAction = "CREATE_PIPELINE"
	UpdatePipeline  RequestAction = "UPDATE_PIPELINE"
	CreateEnv       RequestAction = "CREATE_ENVIRONMENT"
	UpdateEnv       RequestAction = "UPDATE_ENVIRONMENT"
	CreateSecret    RequestAction = "CREATE_SECRET"
	UpdateSecret    RequestAction = "UPDATE_SECRET"
	CreateService   RequestAction = "CREATE_SERVICE"
	UpdateService   RequestAction = "UPDATE_SERVICE"
	CreateConnector RequestAction = "CREATE_CONNECTOR"
	UpdateConnector RequestAction = "UPDATE_CONNECTOR"
	CreateStepGroup RequestAction = "CREATE_STEP_GROUP"
	UpdateStepGroup RequestAction = "UPDATE_STEP_GROUP"
	CreateProcess   RequestAction = "CREATE_PROCESS"
)

type Caller string

const (
	CallerUnifiedAgent Caller = "unified_agent"
)

// GenAIRequest defines the interface for all GenAI request types
type GenAIRequest interface {
	GetBaseParameters() *BaseRequestParameters
	IsStreaming() bool
}

// BaseRequestParameters defines common fields for all GenAI request types
type BaseRequestParameters struct {
	Prompt          string          `json:"prompt"`
	Provider        string          `json:"provider,omitempty"`
	ModelName       string          `json:"model_name,omitempty"`
	ConversationID  string          `json:"conversation_id"`
	InteractionID   string          `json:"interaction_id,omitempty"`
	Capabilities    []Capability    `json:"capabilities,omitempty"`
	ConversationRaw []any           `json:"conversation_raw,omitempty"`
	Context         []ContextItem   `json:"context,omitempty"`
	HarnessContext  *HarnessContext `json:"harness_context,omitempty"`
	Stream          bool            `json:"stream,omitempty"`
	Caller          Caller          `json:"caller,omitempty"`
}

// GetBaseParameters returns the base parameters
func (b *BaseRequestParameters) GetBaseParameters() *BaseRequestParameters {
	return b
}

// IsStreaming returns whether the request is streaming
func (b *BaseRequestParameters) IsStreaming() bool {
	return b.Stream
}

// ServiceChatParameters extends BaseRequestParameters for AI DevOps agent requests
type ServiceChatParameters struct {
	BaseRequestParameters
	Action RequestAction `json:"action,omitempty"`
}

// GetBaseParameters returns the base parameters
func (s *ServiceChatParameters) GetBaseParameters() *BaseRequestParameters {
	return &s.BaseRequestParameters
}

// IsStreaming returns whether the request is streaming
func (s *ServiceChatParameters) IsStreaming() bool {
	return s.BaseRequestParameters.Stream
}

// DatabaseType defines the supported database types
type DatabaseType string

// DBChangesetParameters extends BaseRequestParameters for database changeset generation
type DBChangesetParameters struct {
	BaseRequestParameters
	DatabaseType DatabaseType `json:"database_type"`
	OldChangeset string       `json:"oldchangeset,omitempty"`
	ErrorContext string       `json:"error_context,omitempty"`
}

// GetBaseParameters returns the base parameters
func (d *DBChangesetParameters) GetBaseParameters() *BaseRequestParameters {
	return &d.BaseRequestParameters
}

// IsStreaming returns whether the request is streaming
func (d *DBChangesetParameters) IsStreaming() bool {
	return d.BaseRequestParameters.Stream
}

type CapabilityToRun struct {
	CallID string         `json:"call_id"`
	Type   string         `json:"type"`
	Input  map[string]any `json:"input"`
}

type ServiceChatResponse struct {
	ConversationID    string            `json:"conversation_id"`
	ConversationRaw   string            `json:"conversation_raw"`
	CapabilitiesToRun []CapabilityToRun `json:"capabilities_to_run"`
	ModelUsage        map[string]any    `json:"model_usage,omitempty"`
	Response          string            `json:"response,omitempty"`
	Error             string            `json:"error,omitempty"`
}

type ProgressUpdate struct {
	Progress int    `json:"progress"`          // Current progress step
	Total    int    `json:"total"`             // Total number of steps
	Message  string `json:"message,omitempty"` // Progress message
}
