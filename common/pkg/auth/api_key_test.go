package auth

import (
	"context"
	"testing"
)

func TestAPIKeyProvider_GetHeader(t *testing.T) {
	tests := []struct {
		name          string
		apiKey        string
		expectedKey   string
		expectedValue string
	}{
		{
			name:          "Valid API Key",
			apiKey:        "test-api-key-123",
			expectedKey:   "x-api-key",
			expectedValue: "test-api-key-123",
		},
		{
			name:          "Empty API Key",
			apiKey:        "",
			expectedKey:   "x-api-key",
			expectedValue: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			provider := &APIKeyProvider{
				apiKey: tt.apiKey,
			}

			k, v, err := provider.GetHeader(context.Background())
			if err != nil {
				t.Errorf("APIKeyProvider.GetHeader() error = %v, expected no error", err)
				return
			}

			if k != tt.expectedKey {
				t.Errorf("APIKeyProvider.GetHeader().key = %q, want %q", k, tt.expectedKey)
			}

			if v != tt.expectedValue {
				t.Errorf("APIKeyProvider.GetHeader().value = %q, want %q", v, tt.expectedValue)
			}
		})
	}
}
