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
