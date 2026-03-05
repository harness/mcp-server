package dto

// ContextType defines the type of context for AI DevOps agent
type ContextType string

const (
	// ContextTypeOther represents a generic context type
	ContextTypeOther ContextType = "other"
)

// ContextItem represents a single context item with a type and payload
type ContextItem struct {
	Type    ContextType `json:"type"`
	Payload any         `json:"payload"`
}

// HarnessContext represents harness-specific context information
type HarnessContext struct {
	AccountID string `json:"account_id"`
	OrgID     string `json:"org_id,omitempty"`
	ProjectID string `json:"project_id,omitempty"`
}

// RequestAction defines the set of valid actions that can be performed by the AI service
type RequestAction string

// Constants for the various action types
const (
	CreateStep      RequestAction = "CREATE_STEP"
	UpdateStep      RequestAction = "UPDATE_STEP"
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

// ActionTypeValues returns all valid action types
func ActionTypeValues() []string {
	return []string{
		string(CreateStep),
		string(CreatePipeline),
		string(CreateEnv),
		string(CreateSecret),
		string(CreateService),
		string(CreateConnector),
		string(CreateProcess),
		string(UpdateStep),
		string(UpdatePipeline),
		string(UpdateEnv),
		string(UpdateSecret),
		string(UpdateService),
		string(UpdateConnector),
	}
}

// ConversationMessage represents a single message in a conversation
type ConversationMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ServiceChatRequest defines the parameters for AI DevOps agent requests
type ServiceChatRequest struct {
	HarnessContext  *HarnessContext       `json:"harness_context"`
	Prompt          string                `json:"prompt"`
	Action          RequestAction         `json:"action,omitempty"`
	ConversationID  string                `json:"conversation_id"`
	InteractionID   string                `json:"interaction_id,omitempty"`
	ConversationRaw []ConversationMessage `json:"conversation_raw,omitempty"`
	Context         []ContextItem         `json:"context,omitempty"`
	Stream          bool                  `json:"stream,omitempty"`
}

// ServiceChatResponse represents the response from the Intelligence Service
type ServiceChatResponse struct {
	ConversationID    string                   `json:"conversation_id"`
	ConversationRaw   string                   `json:"conversation_raw,omitempty"`
	InteractionID     string                   `json:"interaction_id,omitempty"`
	CapabilitiesToRun []map[string]interface{} `json:"capabilities_to_run,omitempty"`
	ModelUsage        map[string]interface{}   `json:"model_usage,omitempty"`
	Response          string                   `json:"response,omitempty"`
	Error             string                   `json:"error,omitempty"`
}

// ProgressUpdate represents progress information for streaming responses
type ProgressUpdate struct {
	Progress int    `json:"progress"`          // Current progress step
	Total    int    `json:"total"`             // Total number of steps
	Message  string `json:"message,omitempty"` // Progress message
}
