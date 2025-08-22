package common

import (
	"context"
	"fmt"

	"github.com/harness/harness-mcp/client/dto"
)

// ScopeKey is the context key for storing the scope
type ScopeKey struct{}

// GetScopeFromContext retrieves the scope from the context
func GetScopeFromContext(ctx context.Context) (dto.Scope, error) {
	scope, ok := ctx.Value(ScopeKey{}).(dto.Scope)
	if !ok {
		return dto.Scope{}, fmt.Errorf("scope not found in context")
	}
	return scope, nil
}

// WithScopeContext adds the scope to the context
func WithScopeContext(ctx context.Context, scope dto.Scope) context.Context {
	return context.WithValue(ctx, ScopeKey{}, scope)
}
