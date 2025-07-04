package dto

type ChatHistoryItem struct {
	Question string `json:"question"`
	Answer   string `json:"answer"`
}

type ChatRequest struct {
	Question    string            `json:"question"`
	ChatHistory []ChatHistoryItem `json:"chat_history,omitempty"`
}
