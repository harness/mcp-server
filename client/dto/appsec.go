package dto

// ChatRequestInput represents the input for the chat request
type ChatRequestInput struct {
	ChatRequestType string   `json:"chatRequestType"`
	UserInputs      []string `json:"userInputs"`
}

// LLMChatResult represents individual results from the llmChat subscription
type LLMChatResult struct {
	AgentResponse string `json:"agentResponse"`
}

// LLMChatSubscriptionResponse represents the simplified response from the AppSec llmChat subscription
type LLMChatSubscriptionResponse struct {
	Results []LLMChatResult `json:"results"`
}

// AppSecLLMChatData represents the data field in the GraphQL subscription response
type AppSecLLMChatData struct {
	LLMChat LLMChatSubscriptionResponse `json:"llmChat"`
}

// AppSecResponseItem represents a single item in the response array
type AppSecResponseItem struct {
	Data AppSecLLMChatData `json:"data"`
}

// AppSecQueryRequest represents a request to query the AppSec service
type AppSecQueryRequest struct {
	Query     string `json:"query"`
	AccountID string `json:"accountId"`
}