package license

import (
	"context"
	"log/slog"
	"os"
	"testing"

	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewClientFactory(t *testing.T) {
	tests := []struct {
		name   string
		config *config.Config
		logger *slog.Logger
		want   *ClientFactory
	}{
		{
			name: "valid config and logger",
			config: &config.Config{
				AccountID:        "test-account",
				NgManagerBaseURL: "https://app.harness.io",
				BaseURL:          "https://app.harness.io",
				NgManagerSecret:  "test-secret",
			},
			logger: slog.New(slog.NewTextHandler(os.Stdout, nil)),
			want: &ClientFactory{
				config: &config.Config{
					AccountID:        "test-account",
					NgManagerBaseURL: "https://app.harness.io",
					BaseURL:          "https://app.harness.io",
					NgManagerSecret:  "test-secret",
				},
				logger: slog.New(slog.NewTextHandler(os.Stdout, nil)),
			},
		},
		{
			name:   "nil config",
			config: nil,
			logger: slog.New(slog.NewTextHandler(os.Stdout, nil)),
			want: &ClientFactory{
				config: nil,
				logger: slog.New(slog.NewTextHandler(os.Stdout, nil)),
			},
		},
		{
			name: "nil logger",
			config: &config.Config{
				AccountID: "test-account",
			},
			logger: nil,
			want: &ClientFactory{
				config: &config.Config{
					AccountID: "test-account",
				},
				logger: nil,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := NewClientFactory(tt.config, tt.logger)

			require.NotNil(t, got)
			assert.Equal(t, tt.config, got.config)

			// For logger comparison, we check if both are nil or both are not nil
			// since slog.Logger doesn't have a direct equality comparison
			if tt.logger == nil {
				assert.Nil(t, got.logger)
			} else {
				assert.NotNil(t, got.logger)
			}
		})
	}
}

func TestClientFactory_CreateLicenseClient(t *testing.T) {
	tests := []struct {
		name          string
		config        *config.Config
		expectError   bool
		errorContains string
	}{
		{
			name: "valid config",
			config: &config.Config{
				AccountID:        "test-account",
				NgManagerBaseURL: "https://app.harness.io",
				BaseURL:          "https://app.harness.io",
				NgManagerSecret:  "test-secret",
			},
			expectError: false,
		},
		{
			name: "empty NgManagerBaseURL",
			config: &config.Config{
				AccountID:        "test-account",
				NgManagerBaseURL: "",
				BaseURL:          "https://app.harness.io",
				NgManagerSecret:  "test-secret",
			},
			expectError: false, // The license client creation doesn't validate empty URLs
		},
		{
			name: "empty BaseURL",
			config: &config.Config{
				AccountID:        "test-account",
				NgManagerBaseURL: "https://app.harness.io",
				BaseURL:          "",
				NgManagerSecret:  "test-secret",
			},
			expectError: false, // The license client creation doesn't validate empty URLs
		},
		{
			name: "empty NgManagerSecret",
			config: &config.Config{
				AccountID:        "test-account",
				NgManagerBaseURL: "https://app.harness.io",
				BaseURL:          "https://app.harness.io",
				NgManagerSecret:  "",
			},
			expectError: false, // The license client creation doesn't validate empty secrets
		},
		{
			name:        "nil config",
			config:      nil,
			expectError: true, // This should cause a panic/error when accessing config fields
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
			factory := NewClientFactory(tt.config, logger)

			ctx := context.Background()

			if tt.expectError {
				// For nil config, we expect a panic or error
				assert.Panics(t, func() {
					client, err := factory.CreateLicenseClient(ctx)
					_ = client
					_ = err
				})
			} else {
				client, err := factory.CreateLicenseClient(ctx)
				assert.NoError(t, err)
				assert.NotNil(t, client)
			}
		})
	}
}

func TestClientFactory_CreateLicenseClient_WithContext(t *testing.T) {
	config := &config.Config{
		AccountID:        "test-account",
		NgManagerBaseURL: "https://app.harness.io",
		BaseURL:          "https://app.harness.io",
		NgManagerSecret:  "test-secret",
	}

	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	factory := NewClientFactory(config, logger)

	t.Run("context with timeout", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		client, err := factory.CreateLicenseClient(ctx)
		assert.NoError(t, err)
		assert.NotNil(t, client)
	})

	t.Run("cancelled context", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		cancel() // Cancel immediately

		// The license client creation itself doesn't check context cancellation
		// but we test that it doesn't panic with cancelled context
		client, err := factory.CreateLicenseClient(ctx)
		// This should still succeed as the context is only used for the HTTP client creation
		assert.NoError(t, err)
		assert.NotNil(t, client)
	})
}

func TestClientFactory_Consistency(t *testing.T) {
	// Test that multiple calls with same parameters return equivalent clients
	config := &config.Config{
		AccountID:        "test-account",
		NgManagerBaseURL: "https://app.harness.io",
		BaseURL:          "https://app.harness.io",
		NgManagerSecret:  "test-secret",
	}

	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	factory := NewClientFactory(config, logger)

	ctx := context.Background()

	client1, err1 := factory.CreateLicenseClient(ctx)
	require.NoError(t, err1)
	require.NotNil(t, client1)

	client2, err2 := factory.CreateLicenseClient(ctx)
	require.NoError(t, err2)
	require.NotNil(t, client2)

	// Both clients should be created successfully
	// Note: The factory reuses the same client instance for efficiency
	// so both calls should return the same instance
	assert.Same(t, client1, client2, "Should reuse the same client instance for efficiency")
}

func TestClientFactory_ThreadSafety(t *testing.T) {
	// Test concurrent access to the factory
	config := &config.Config{
		AccountID:        "test-account",
		NgManagerBaseURL: "https://app.harness.io",
		BaseURL:          "https://app.harness.io",
		NgManagerSecret:  "test-secret",
	}

	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	factory := NewClientFactory(config, logger)

	const numGoroutines = 10
	results := make(chan error, numGoroutines)

	ctx := context.Background()

	// Launch multiple goroutines that create license clients concurrently
	for i := 0; i < numGoroutines; i++ {
		go func() {
			client, err := factory.CreateLicenseClient(ctx)
			if err != nil {
				results <- err
				return
			}
			if client == nil {
				results <- assert.AnError
				return
			}
			results <- nil
		}()
	}

	// Collect results
	for i := 0; i < numGoroutines; i++ {
		err := <-results
		assert.NoError(t, err, "Concurrent license client creation should not fail")
	}
}

// Benchmark tests
func BenchmarkClientFactory_CreateLicenseClient(b *testing.B) {
	config := &config.Config{
		AccountID:        "test-account",
		NgManagerBaseURL: "https://app.harness.io",
		BaseURL:          "https://app.harness.io",
		NgManagerSecret:  "test-secret",
	}

	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	factory := NewClientFactory(config, logger)
	ctx := context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		client, err := factory.CreateLicenseClient(ctx)
		if err != nil {
			b.Fatal(err)
		}
		if client == nil {
			b.Fatal("client is nil")
		}
	}
}
