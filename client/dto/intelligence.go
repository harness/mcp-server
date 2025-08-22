package dto

// SimilaritySearchRequest represents a request for similarity search
type SimilaritySearchRequest struct {
	AccountID    string `json:"account_identifier"`
	OrgID        string `json:"org_identifier,omitempty"`
	ProjectID    string `json:"project_identifier,omitempty"`
	Description  string `json:"description"`
	Count        int    `json:"count,omitempty"`
	TemplateType string `json:"template_type,omitempty"`
}

// SimilaritySearchResult represents a single similarity search result
type SimilaritySearchResult struct {
	ID       string      `json:"id"`
	Text     string      `json:"text"`
	Score    float64     `json:"score"`
	Metadata interface{} `json:"metadata,omitempty"`
}

// SimilaritySearchResponse represents the response from a similarity search
type SimilaritySearchResponse struct {
	Results []SimilaritySearchResult `json:"results"`
}

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
	OrgID     string `json:"org_id"`
	ProjectID string `json:"project_id"`
	AccountID string `json:"account_id"`
}

// RequestAction defines the set of valid actions that can be performed by the AI service
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

func ActionTypeValues() []string {
	return []string{
		string(CreateStep),
		string(CreateStage),
		string(CreatePipeline),
		string(CreateEnv),
		string(CreateSecret),
		string(CreateService),
		string(CreateConnector),
		string(CreateStepGroup),
		string(CreateProcess),
		string(UpdateStep),
		string(UpdateStage),
		string(UpdatePipeline),
		string(UpdateEnv),
		string(UpdateSecret),
		string(UpdateService),
		string(UpdateConnector),
		string(UpdateStepGroup),
	}
}

// ServiceChatParameters defines the parameters for AI DevOps agent requests
type ServiceChatParameters struct {
	BaseRequestParameters
	Action RequestAction `json:"action,omitempty"`
}

// GetBaseParameters returns the base parameters for ServiceChatParameters
func (s *ServiceChatParameters) GetBaseParameters() *BaseRequestParameters {
	return &s.BaseRequestParameters
}

// IsStreaming returns whether the request is streaming for ServiceChatParameters
func (s *ServiceChatParameters) IsStreaming() bool {
	return s.Stream
}

type ServiceChatResponseIntelligence struct {
    ConversationID    string                   `json:"conversation_id"`
    ConversationRaw   string                   `json:"conversation_raw"`
    InteractionID     string                   `json:"interaction_id,omitempty"`
    CapabilitiesToRun []map[string]interface{} `json:"capabilities_to_run,omitempty"`
    ModelUsage        map[string]interface{}   `json:"model_usage,omitempty"`
    // Keep these for backward compatibility if needed elsewhere
    Response string `json:"response,omitempty"`
    Error    string `json:"error,omitempty"`
}

// ProgressUpdate represents progress information for streaming responses
type ProgressUpdate struct {
	Progress int    `json:"progress"`          // Current progress step
	Total    int    `json:"total"`             // Total number of steps
	Message  string `json:"message,omitempty"` // Progress message
}
