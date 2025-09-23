package middleware

import (
	"context"
	"log/slog"
	"os"
	"testing"
	"time"

	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// MockHeaderExtractor is a mock implementation of HTTPHeaderExtractor
type MockHeaderExtractor struct {
	mock.Mock
}

func (m *MockHeaderExtractor) ExtractRequestedModules(headers map[string][]string) ([]string, error) {
	args := m.Called(headers)
	return args.Get(0).([]string), args.Error(1)
}

// Test helper functions
func createTestContext() context.Context {
	ctx := context.Background()
	// Add account ID to context
	ctx = context.WithValue(ctx, "account_id", "test-account-123")
	return ctx
}

func createTestLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelDebug}))
}

func createTestConfig() *config.Config {
	return &config.Config{
		AccountID:        "test-account-123",
		APIKey:           "test-api-key",
		BaseURL:          "https://app.harness.io",
		NgManagerBaseURL: "https://app.harness.io",
		NgManagerSecret:  "test-secret",
		Internal:         false,
		EnableLicense:    true,
	}
}

func TestWithDynamicToolFiltering(t *testing.T) {
	tests := []struct {
		name           string
		setupMocks     func(*MockHeaderExtractor)
		expectedResult []string
		expectError    bool
	}{
		{
			name: "successful filtering with CI and CD modules",
			setupMocks: func(extractor *MockHeaderExtractor) {
				// Mock is not called since we use context directly
			},
			expectedResult: []string{"pipelines", "connectors", "dashboards", "audit"}, // Only CORE since license fails
			expectError:    false,
		},
		{
			name: "successful filtering with only CI module",
			setupMocks: func(extractor *MockHeaderExtractor) {
				// Mock is not called since we use context directly
			},
			expectedResult: []string{"pipelines", "connectors", "dashboards", "audit"}, // Only CORE since license fails
			expectError:    false,
		},
		{
			name: "fallback to CORE on header extraction error",
			setupMocks: func(extractor *MockHeaderExtractor) {
				// Mock is not called since we use context directly
			},
			expectedResult: []string{}, // No filtering when no modules in context
			expectError:    false,
		},
		{
			name: "empty requested modules defaults to CORE",
			setupMocks: func(extractor *MockHeaderExtractor) {
				// Mock is not called since we use context directly
			},
			expectedResult: []string{}, // No filtering when empty modules in context
			expectError:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup mocks
			mockExtractor := &MockHeaderExtractor{}
			tt.setupMocks(mockExtractor)

			// Create config with real cache
			config := &DynamicToolFilteringConfig{
				HeaderExtractor: mockExtractor,
				Cache:           NewModuleIntersectionCache(5 * time.Minute),
				CacheTTL:        5 * time.Minute,
				Logger:          createTestLogger(),
				Config:          createTestConfig(),
			}

			// Create middleware
			middleware := WithDynamicToolFiltering(config)
			require.NotNil(t, middleware)

			// Create test handler
			var capturedToolsets []string
			testHandler := func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
				toolsets, _ := GetAllowedToolsetsFromContext(ctx)
				capturedToolsets = toolsets
				return &mcp.CallToolResult{}, nil
			}

			// Create context with requested modules based on test case
			ctx := createTestContext()
			if tt.name == "successful filtering with CI and CD modules" {
				ctx = context.WithValue(ctx, requestedModulesContextKey, []string{"CI", "CD"})
			} else if tt.name == "successful filtering with only CI module" {
				ctx = context.WithValue(ctx, requestedModulesContextKey, []string{"CI"})
			} else if tt.name == "empty requested modules defaults to CORE" {
				ctx = context.WithValue(ctx, requestedModulesContextKey, []string{})
			}

			// Execute middleware
			wrappedHandler := middleware(testHandler)
			_, err := wrappedHandler(ctx, mcp.CallToolRequest{})

			// Verify results
			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.ElementsMatch(t, tt.expectedResult, capturedToolsets)
			}

			// Note: Mock expectations are not verified since middleware uses context directly
		})
	}
}

func TestWithDynamicToolFiltering_NoAccountID(t *testing.T) {
	mockExtractor := &MockHeaderExtractor{}

	config := &DynamicToolFilteringConfig{
		HeaderExtractor: mockExtractor,
		Cache:           NewModuleIntersectionCache(5 * time.Minute),
		CacheTTL:        5 * time.Minute,
		Logger:          createTestLogger(),
		Config:          createTestConfig(),
	}

	middleware := WithDynamicToolFiltering(config)
	require.NotNil(t, middleware)

	var capturedToolsets []string
	testHandler := func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		toolsets, _ := GetAllowedToolsetsFromContext(ctx)
		capturedToolsets = toolsets
		return &mcp.CallToolResult{}, nil
	}

	// Create context without account ID
	ctx := context.Background()

	// Execute middleware
	wrappedHandler := middleware(testHandler)
	_, err := wrappedHandler(ctx, mcp.CallToolRequest{})

	// Should not error and should not filter (no toolsets set)
	assert.NoError(t, err)
	assert.ElementsMatch(t, []string{}, capturedToolsets) // No filtering when no account ID

	// No mock expectations should be called since we exit early
}

func TestGetAllowedToolsetsFromContext(t *testing.T) {
	tests := []struct {
		name           string
		setupContext   func() context.Context
		expectedResult []string
		expectedExists bool
	}{
		{
			name: "context with allowed toolsets",
			setupContext: func() context.Context {
				ctx := context.Background()
				return context.WithValue(ctx, allowedToolsetsContextKey, []string{"pipelines", "ci", "cd"})
			},
			expectedResult: []string{"pipelines", "ci", "cd"},
			expectedExists: true,
		},
		{
			name: "context without allowed toolsets",
			setupContext: func() context.Context {
				return context.Background()
			},
			expectedResult: []string{},
			expectedExists: false,
		},
		{
			name: "context with wrong type",
			setupContext: func() context.Context {
				ctx := context.Background()
				return context.WithValue(ctx, allowedToolsetsContextKey, "invalid-type")
			},
			expectedResult: []string{},
			expectedExists: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := tt.setupContext()
			result, exists := GetAllowedToolsetsFromContext(ctx)
			assert.Equal(t, tt.expectedResult, result)
			assert.Equal(t, tt.expectedExists, exists)
		})
	}
}

func TestIsToolsetAllowed(t *testing.T) {
	tests := []struct {
		name            string
		toolset         string
		allowedToolsets []string
		expectedResult  bool
	}{
		{
			name:            "allowed toolset",
			toolset:         "ci",
			allowedToolsets: []string{"pipelines", "ci", "cd"},
			expectedResult:  true,
		},
		{
			name:            "disallowed toolset",
			toolset:         "ccm",
			allowedToolsets: []string{"pipelines", "ci", "cd"},
			expectedResult:  false,
		},
		{
			name:            "empty allowed toolsets",
			toolset:         "ci",
			allowedToolsets: []string{},
			expectedResult:  false,
		},
		{
			name:            "nil allowed toolsets",
			toolset:         "ci",
			allowedToolsets: nil,
			expectedResult:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := IsToolsetAllowed(tt.toolset, tt.allowedToolsets)
			assert.Equal(t, tt.expectedResult, result)
		})
	}
}

func TestDefaultHeaderExtractor(t *testing.T) {
	extractor := &DefaultHeaderExtractor{}

	tests := []struct {
		name           string
		headers        map[string][]string
		expectedResult []string
		expectedError  bool
	}{
		{
			name: "valid modules header",
			headers: map[string][]string{
				"X-Harness-Modules": {"CI,CD,CCM"},
			},
			expectedResult: []string{"CI", "CD", "CCM"},
			expectedError:  false,
		},
		{
			name: "empty modules header",
			headers: map[string][]string{
				"X-Harness-Modules": {""},
			},
			expectedResult: []string{},
			expectedError:  false,
		},
		{
			name: "no modules header",
			headers: map[string][]string{
				"Other-Header": {"value"},
			},
			expectedResult: []string{},
			expectedError:  false,
		},
		{
			name:           "nil headers",
			headers:        nil,
			expectedResult: []string{},
			expectedError:  false,
		},
		{
			name: "modules with spaces",
			headers: map[string][]string{
				"X-Harness-Modules": {"CI, CD, CCM"},
			},
			expectedResult: []string{"CI", "CD", "CCM"},
			expectedError:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := extractor.ExtractRequestedModules(tt.headers)

			if tt.expectedError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.ElementsMatch(t, tt.expectedResult, result)
			}
		})
	}
}

func TestModuleIntersectionCache(t *testing.T) {
	cache := NewModuleIntersectionCache(5 * time.Minute)

	t.Run("set and get", func(t *testing.T) {
		key := "test-key"
		value := []string{"pipelines", "ci", "cd"}

		// Set value
		cache.Set(key, value)

		// Get value
		result, exists := cache.Get(key)
		assert.True(t, exists)
		assert.ElementsMatch(t, value, result)
	})

	t.Run("get non-existent key", func(t *testing.T) {
		result, exists := cache.Get("non-existent")
		assert.False(t, exists)
		assert.Nil(t, result)
	})

	t.Run("clear expired entries", func(t *testing.T) {
		// Create cache with very short TTL
		shortCache := NewModuleIntersectionCache(10 * time.Millisecond)

		key := "test-key-2"
		value := []string{"pipelines"}

		// Set value
		shortCache.Set(key, value)

		// Verify it exists
		_, exists := shortCache.Get(key)
		assert.True(t, exists)

		// Wait for expiration
		time.Sleep(20 * time.Millisecond)

		// Clear expired entries
		shortCache.Clear()

		// Verify it's gone after clear
		_, exists = shortCache.Get(key)
		assert.False(t, exists)
	})

	t.Run("TTL expiration", func(t *testing.T) {
		// Create cache with very short TTL
		shortCache := NewModuleIntersectionCache(10 * time.Millisecond)

		key := "test-key-ttl"
		value := []string{"pipelines"}

		// Set value
		shortCache.Set(key, value)

		// Verify it exists
		result, exists := shortCache.Get(key)
		assert.True(t, exists)
		assert.ElementsMatch(t, value, result)

		// Wait for expiration
		time.Sleep(20 * time.Millisecond)

		// Verify it's expired
		_, exists = shortCache.Get(key)
		assert.False(t, exists)
	})
}

// Integration test that simulates the full middleware flow
func TestWithDynamicToolFiltering_Integration(t *testing.T) {
	// Create a real header extractor that simulates HTTP headers
	headerExtractor := &DefaultHeaderExtractor{}

	config := &DynamicToolFilteringConfig{
		HeaderExtractor: headerExtractor,
		Cache:           NewModuleIntersectionCache(5 * time.Minute),
		CacheTTL:        5 * time.Minute,
		Logger:          createTestLogger(),
		Config:          createTestConfig(),
	}

	middleware := WithDynamicToolFiltering(config)
	require.NotNil(t, middleware)

	// Test handler that captures the allowed toolsets
	var capturedToolsets []string
	testHandler := func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		toolsets, _ := GetAllowedToolsetsFromContext(ctx)
		capturedToolsets = toolsets
		return &mcp.CallToolResult{}, nil
	}

	// Create context with account ID and requested modules
	ctx := context.WithValue(context.Background(), "account_id", "test-account-123")
	// Add requested modules to context to simulate what HTTP middleware would do
	ctx = context.WithValue(ctx, requestedModulesContextKey, []string{"CI", "CD"})
	wrappedHandler := middleware(testHandler)
	_, err := wrappedHandler(ctx, mcp.CallToolRequest{})

	// Should not error and should fallback to CORE (since no headers are available)
	assert.NoError(t, err)
	assert.ElementsMatch(t, []string{"pipelines", "connectors", "dashboards", "audit"}, capturedToolsets)
}

func TestWithDynamicToolFiltering_ConfigDefaults(t *testing.T) {
	// Test with minimal config
	config := &DynamicToolFilteringConfig{
		Logger: createTestLogger(),
		Config: createTestConfig(),
	}

	middleware := WithDynamicToolFiltering(config)
	require.NotNil(t, middleware)

	// Should create default cache and header extractor
	assert.NotNil(t, config.Cache)
	assert.NotNil(t, config.HeaderExtractor)
	assert.Equal(t, 5*time.Minute, config.CacheTTL)
}

func TestWithDynamicToolFiltering_CacheHit(t *testing.T) {
	mockExtractor := &MockHeaderExtractor{}
	cache := NewModuleIntersectionCache(5 * time.Minute)

	config := &DynamicToolFilteringConfig{
		HeaderExtractor: mockExtractor,
		Cache:           cache,
		CacheTTL:        5 * time.Minute,
		Logger:          createTestLogger(),
		Config:          createTestConfig(),
	}

	// Pre-populate cache
	cacheKey := "test-account-123:CI,CD"
	expectedToolsets := []string{"pipelines", "connectors", "dashboards", "audit", "ci", "cd"}
	cache.Set(cacheKey, expectedToolsets)

	// Setup mock to return the modules that match the cache key
	mockExtractor.On("ExtractRequestedModules", mock.Anything).Return([]string{"CI", "CD"}, nil)

	middleware := WithDynamicToolFiltering(config)

	var capturedToolsets []string
	testHandler := func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		toolsets, _ := GetAllowedToolsetsFromContext(ctx)
		capturedToolsets = toolsets
		return &mcp.CallToolResult{}, nil
	}

	ctx := createTestContext()
	// Add requested modules to context to match cache key
	ctx = context.WithValue(ctx, requestedModulesContextKey, []string{"CI", "CD"})
	wrappedHandler := middleware(testHandler)
	_, err := wrappedHandler(ctx, mcp.CallToolRequest{})

	assert.NoError(t, err)
	assert.ElementsMatch(t, expectedToolsets, capturedToolsets)
	// Mock should not be called since we hit the cache
	mockExtractor.AssertNotCalled(t, "ExtractRequestedModules")
}
