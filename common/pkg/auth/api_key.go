package auth

import (
	"context"
)

var (
	apiKeyHeaderName = "x-api-key"
)

type APIKeyProvider struct {
	apiKey string
}

// NewAPIKeyProvider creates a new APIKeyProvider
func NewAPIKeyProvider(apiKey string) *APIKeyProvider {
	return &APIKeyProvider{apiKey: apiKey}
}

// GetHeader returns the API key header
func (p *APIKeyProvider) GetHeader(ctx context.Context) (string, string, error) {
	return apiKeyHeaderName, p.apiKey, nil
}
