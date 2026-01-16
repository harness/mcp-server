package auth

import (
	"context"
	"fmt"
)

type contextKey string

const (
	authHeaderKeyCtx   contextKey = "auth_header_key"
	authHeaderValueCtx contextKey = "auth_header_value"
)

// ContextProvider reads authentication from context
// This is used to pass through auth from incoming HTTP requests to downstream services
type ContextProvider struct {
	fallbackProvider Provider
}

// NewContextProvider creates a new ContextProvider with an optional fallback
func NewContextProvider(fallback Provider) *ContextProvider {
	return &ContextProvider{
		fallbackProvider: fallback,
	}
}

// GetHeader retrieves auth from context, falls back to fallbackProvider if not in context
func (p *ContextProvider) GetHeader(ctx context.Context) (string, string, error) {
	// Try to get from context first
	if key, ok := ctx.Value(authHeaderKeyCtx).(string); ok {
		if value, ok := ctx.Value(authHeaderValueCtx).(string); ok {
			return key, value, nil
		}
	}

	// Fall back to the fallback provider
	if p.fallbackProvider != nil {
		return p.fallbackProvider.GetHeader(ctx)
	}

	return "", "", fmt.Errorf("no authentication found in context or fallback provider")
}

// WithAuthInContext adds authentication headers to the context
func WithAuthInContext(ctx context.Context, key, value string) context.Context {
	ctx = context.WithValue(ctx, authHeaderKeyCtx, key)
	ctx = context.WithValue(ctx, authHeaderValueCtx, value)
	return ctx
}

// GetAuthFromContext retrieves authentication from context
func GetAuthFromContext(ctx context.Context) (key, value string, ok bool) {
	keyVal, keyOk := ctx.Value(authHeaderKeyCtx).(string)
	valueVal, valueOk := ctx.Value(authHeaderValueCtx).(string)
	return keyVal, valueVal, keyOk && valueOk
}
