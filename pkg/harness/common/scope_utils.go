package common

import (
	"context"
	"fmt"
	"github.com/harness/harness-mcp/client/dto"
)

// AccountIDKey is the context key for storing the account ID
type AccountIDKey struct{}

// ScopeKey is the context key for storing the scope
type ScopeKey struct{}

// GetAccountIDFromContext retrieves the account ID from the context
func GetAccountIDFromContext(ctx context.Context) (string, error) {
	// First try to get from scope
	scope, err := GetScopeFromContext(ctx)
	if err == nil {
		return scope.AccountID, nil
	}

	// Fall back to direct account ID
	accountID, ok := ctx.Value(AccountIDKey{}).(string)
	if !ok || accountID == "" {
		return "", fmt.Errorf("account_id is required but not found in context")
	}
	return accountID, nil
}

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
