package dto

type Capability struct {
	Type    string `json:"type"`
	Version string `json:"version"`
}

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

// IDPWorkflowParameters extends BaseRequestParameters for workflow generation
type IDPWorkflowParameters struct {
	BaseRequestParameters
	PipelineInfo string `json:"pipeline_info"`
	OldWorkflow  string `json:"oldworkflow,omitempty"`
	ErrorContext string `json:"error_context,omitempty"`
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
