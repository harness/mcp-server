package auth

import (
	"context"
	"testing"
)

func TestContextProvider_GetHeader_FromContext(t *testing.T) {
	ctx := context.Background()
	ctx = WithAuthInContext(ctx, "x-api-key", "test-key-123")

	provider := NewContextProvider(nil)
	key, value, err := provider.GetHeader(ctx)

	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if key != "x-api-key" {
		t.Errorf("Expected key 'x-api-key', got %v", key)
	}
	if value != "test-key-123" {
		t.Errorf("Expected value 'test-key-123', got %v", value)
	}
}

func TestContextProvider_GetHeader_FromFallback(t *testing.T) {
	ctx := context.Background()
	fallback := NewAPIKeyProvider("fallback-key")
	provider := NewContextProvider(fallback)

	key, value, err := provider.GetHeader(ctx)

	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if key != "x-api-key" {
		t.Errorf("Expected key 'x-api-key', got %v", key)
	}
	if value != "fallback-key" {
		t.Errorf("Expected value 'fallback-key', got %v", value)
	}
}

func TestContextProvider_GetHeader_NoContextNoFallback(t *testing.T) {
	ctx := context.Background()
	provider := NewContextProvider(nil)

	_, _, err := provider.GetHeader(ctx)

	if err == nil {
		t.Error("Expected error, got nil")
	}
}

func TestWithAuthInContext(t *testing.T) {
	ctx := context.Background()
	ctx = WithAuthInContext(ctx, "Authorization", "Bearer token")

	key, value, ok := GetAuthFromContext(ctx)

	if !ok {
		t.Error("Expected auth to be in context")
	}
	if key != "Authorization" {
		t.Errorf("Expected key 'Authorization', got %v", key)
	}
	if value != "Bearer token" {
		t.Errorf("Expected value 'Bearer token', got %v", value)
	}
}

func TestGetAuthFromContext_Missing(t *testing.T) {
	ctx := context.Background()

	_, _, ok := GetAuthFromContext(ctx)

	if ok {
		t.Error("Expected auth not to be in context")
	}
}
