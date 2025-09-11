package auth

import (
	"context"
)

var (
	bearerHeaderName = "Authorization"
)

// BearerTokenProvider implements Provider for Bearer token authentication
type BearerTokenProvider struct {
	token string
}

// NewBearerTokenProvider creates a new BearerTokenProvider
func NewBearerTokenProvider(token string) *BearerTokenProvider {
	return &BearerTokenProvider{token: token}
}

// GetHeader returns the Authorization header with Bearer token
func (p *BearerTokenProvider) GetHeader(ctx context.Context) (string, string, error) {
	return bearerHeaderName, "Bearer " + p.token, nil
}