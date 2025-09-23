package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewHTTPToolFilteringMiddleware(t *testing.T) {
	logger := createTestLogger()
	middleware := NewHTTPToolFilteringMiddleware(logger, createTestConfig())
	
	assert.NotNil(t, middleware)
	// Logger is modified with component, so just check it's not nil
	assert.NotNil(t, middleware.Logger)
	assert.NotNil(t, middleware.Config)
}

func TestHTTPToolFilteringMiddleware_isToolsListRequest(t *testing.T) {
	middleware := NewHTTPToolFilteringMiddleware(createTestLogger(), createTestConfig())
	logger := createTestLogger()

	tests := []struct {
		name           string
		method         string
		body           string
		expectedResult bool
	}{
		{
			name:           "valid tools/list request",
			method:         "POST",
			body:           `{"jsonrpc": "2.0", "method": "tools/list", "id": 1}`,
			expectedResult: true,
		},
		{
			name:           "tools/call request",
			method:         "POST",
			body:           `{"jsonrpc": "2.0", "method": "tools/call", "id": 1}`,
			expectedResult: false,
		},
		{
			name:           "GET request",
			method:         "GET",
			body:           "",
			expectedResult: false,
		},
		{
			name:           "invalid JSON",
			method:         "POST",
			body:           `{invalid json}`,
			expectedResult: false,
		},
		{
			name:           "empty body",
			method:         "POST",
			body:           "",
			expectedResult: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, "/mcp", strings.NewReader(tt.body))
			result := middleware.isToolsListRequest(req, logger)
			assert.Equal(t, tt.expectedResult, result)
		})
	}
}

func TestHTTPToolFilteringMiddleware_isToolsCallRequest(t *testing.T) {
	middleware := NewHTTPToolFilteringMiddleware(createTestLogger(), createTestConfig())
	logger := createTestLogger()

	tests := []struct {
		name           string
		method         string
		body           string
		expectedResult bool
	}{
		{
			name:           "valid tools/call request",
			method:         "POST",
			body:           `{"jsonrpc": "2.0", "method": "tools/call", "id": 1}`,
			expectedResult: true,
		},
		{
			name:           "tools/list request",
			method:         "POST",
			body:           `{"jsonrpc": "2.0", "method": "tools/list", "id": 1}`,
			expectedResult: false,
		},
		{
			name:           "GET request",
			method:         "GET",
			body:           "",
			expectedResult: false,
		},
		{
			name:           "invalid JSON",
			method:         "POST",
			body:           `{invalid json}`,
			expectedResult: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, "/mcp", strings.NewReader(tt.body))
			result := middleware.isToolsCallRequest(req, logger)
			assert.Equal(t, tt.expectedResult, result)
		})
	}
}

func TestHTTPToolFilteringMiddleware_extractToolNameFromRequest(t *testing.T) {
	middleware := NewHTTPToolFilteringMiddleware(createTestLogger(), createTestConfig())
	logger := createTestLogger()

	tests := []struct {
		name           string
		body           string
		expectedResult string
		expectedError  bool
	}{
		{
			name:           "valid tools/call request",
			body:           `{"jsonrpc": "2.0", "method": "tools/call", "params": {"name": "get_pipeline"}, "id": 1}`,
			expectedResult: "get_pipeline",
			expectedError:  false,
		},
		{
			name:           "missing tool name",
			body:           `{"jsonrpc": "2.0", "method": "tools/call", "params": {}, "id": 1}`,
			expectedResult: "",
			expectedError:  true,
		},
		{
			name:           "invalid JSON",
			body:           `{invalid json}`,
			expectedResult: "",
			expectedError:  true,
		},
		{
			name:           "empty body",
			body:           "",
			expectedResult: "",
			expectedError:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("POST", "/mcp", strings.NewReader(tt.body))
			result, err := middleware.extractToolNameFromRequest(req, logger)
			
			if tt.expectedError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedResult, result)
			}
		})
	}
}

func TestHTTPToolFilteringMiddleware_isToolsetAllowed(t *testing.T) {
	middleware := NewHTTPToolFilteringMiddleware(createTestLogger(), createTestConfig())

	tests := []struct {
		name           string
		toolset        string
		allowedToolsets []string
		expectedResult bool
	}{
		{
			name:           "allowed toolset",
			toolset:        "ci",
			allowedToolsets: []string{"pipelines", "ci", "cd"},
			expectedResult: true,
		},
		{
			name:           "disallowed toolset",
			toolset:        "ccm",
			allowedToolsets: []string{"pipelines", "ci", "cd"},
			expectedResult: false,
		},
		{
			name:           "empty allowed toolsets",
			toolset:        "ci",
			allowedToolsets: []string{},
			expectedResult: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := middleware.isToolsetAllowed(tt.toolset, tt.allowedToolsets)
			assert.Equal(t, tt.expectedResult, result)
		})
	}
}

func TestFindToolGroup(t *testing.T) {
	logger := createTestLogger()

	tests := []struct {
		name           string
		toolName       string
		expectedResult string
	}{
		{
			name:           "pipeline tool",
			toolName:       "get_pipeline",
			expectedResult: "pipelines",
		},
		{
			name:           "connector tool",
			toolName:       "list_connectors",
			expectedResult: "connectors",
		},
		{
			name:           "dashboard tool",
			toolName:       "get_dashboard",
			expectedResult: "dashboards",
		},
		{
			name:           "audit tool",
			toolName:       "get_audit_logs",
			expectedResult: "audit",
		},
		{
			name:           "CI tool",
			toolName:       "get_build_details",
			expectedResult: "ci",
		},
		{
			name:           "CD tool",
			toolName:       "get_deployment_status",
			expectedResult: "cd",
		},
		{
			name:           "CCM tool",
			toolName:       "get_cost_analysis",
			expectedResult: "ccm",
		},
		{
			name:           "STO tool",
			toolName:       "get_security_scan",
			expectedResult: "sto",
		},
		{
			name:           "unknown tool",
			toolName:       "unknown_tool",
			expectedResult: "pipelines", // defaults to pipelines (CORE)
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := findToolGroup(tt.toolName, logger)
			assert.Equal(t, tt.expectedResult, result)
		})
	}
}

func TestHTTPToolFilteringMiddleware_enrichContextWithDynamicFiltering(t *testing.T) {
	middleware := NewHTTPToolFilteringMiddleware(createTestLogger(), createTestConfig())
	logger := createTestLogger()

	tests := []struct {
		name           string
		setupRequest   func() *http.Request
		expectedResult bool // whether context should be enriched
	}{
		{
			name: "request with account ID header",
			setupRequest: func() *http.Request {
				req := httptest.NewRequest("POST", "/mcp", nil)
				req.Header.Set("X-Harness-Account-ID", "test-account-123")
				req.Header.Set("X-Harness-Modules", "CI,CD")
				return req
			},
			expectedResult: true,
		},
		{
			name: "request without account ID",
			setupRequest: func() *http.Request {
				req := httptest.NewRequest("POST", "/mcp", nil)
				req.Header.Set("X-Harness-Modules", "CI,CD")
				return req
			},
			expectedResult: false,
		},
		{
			name: "request without modules header",
			setupRequest: func() *http.Request {
				req := httptest.NewRequest("POST", "/mcp", nil)
				req.Header.Set("X-Harness-Account-ID", "test-account-123")
				return req
			},
			expectedResult: false, // No modules header means no enrichment
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := tt.setupRequest()
			ctx := context.Background()
			
			enrichedCtx := middleware.enrichContextWithDynamicFiltering(ctx, req, logger)
			
			// Check if context was enriched by looking for account ID
			accountID := extractAccountIDFromHTTPRequest(req, logger)
			if tt.expectedResult && accountID != "" {
				// Context should have been enriched
				assert.NotEqual(t, ctx, enrichedCtx)
			}
		})
	}
}

func TestExtractAccountIDFromHTTPRequest(t *testing.T) {
	logger := createTestLogger()

	tests := []struct {
		name           string
		setupRequest   func() *http.Request
		expectedResult string
	}{
		{
			name: "account ID in header",
			setupRequest: func() *http.Request {
				req := httptest.NewRequest("POST", "/mcp", nil)
				req.Header.Set("X-Harness-Account-ID", "test-account-123")
				return req
			},
			expectedResult: "test-account-123",
		},
		{
			name: "no account ID header",
			setupRequest: func() *http.Request {
				req := httptest.NewRequest("POST", "/mcp", nil)
				return req
			},
			expectedResult: "", // Will be generated, so we'll check it's not empty
		},
		{
			name: "empty account ID header",
			setupRequest: func() *http.Request {
				req := httptest.NewRequest("POST", "/mcp", nil)
				req.Header.Set("X-Harness-Account-ID", "")
				return req
			},
			expectedResult: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := tt.setupRequest()
			result := extractAccountIDFromHTTPRequest(req, logger)
			assert.Equal(t, tt.expectedResult, result)
		})
	}
}

func TestExtractRequestIDFromHTTPRequest(t *testing.T) {
	tests := []struct {
		name           string
		setupRequest   func() *http.Request
		expectedResult string
	}{
		{
			name: "request ID in header",
			setupRequest: func() *http.Request {
				req := httptest.NewRequest("POST", "/mcp", nil)
				req.Header.Set("X-Request-ID", "req-123")
				return req
			},
			expectedResult: "req-123",
		},
		{
			name: "no request ID header",
			setupRequest: func() *http.Request {
				req := httptest.NewRequest("POST", "/mcp", nil)
				return req
			},
			expectedResult: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := tt.setupRequest()
			result := extractRequestIDFromHTTPRequest(req)
			if tt.expectedResult == "" {
				// For cases where no header is set, function should generate an ID
				assert.NotEmpty(t, result)
				assert.Contains(t, result, "http_req_")
			} else {
				assert.Equal(t, tt.expectedResult, result)
			}
		})
	}
}

func TestHTTPToolFilteringMiddleware_writeErrorResponse(t *testing.T) {
	middleware := NewHTTPToolFilteringMiddleware(createTestLogger(), createTestConfig())
	logger := createTestLogger()

	w := httptest.NewRecorder()
	message := "Test error message"

	middleware.writeErrorResponse(w, message, logger)

	// Check response
	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Equal(t, "application/json", w.Header().Get("Content-Type"))

	// Parse response body
	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	assert.Equal(t, "2.0", response["jsonrpc"])
	assert.Nil(t, response["id"])
	
	errorObj, ok := response["error"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, float64(-32600), errorObj["code"])
	assert.Equal(t, message, errorObj["message"])
}

func TestHTTPToolFilteringMiddleware_writeAuthorizationErrorResponse(t *testing.T) {
	middleware := NewHTTPToolFilteringMiddleware(createTestLogger(), createTestConfig())
	logger := createTestLogger()

	w := httptest.NewRecorder()
	toolName := "test_tool"
	allowedToolsets := []string{"pipelines", "ci"}

	middleware.writeAuthorizationErrorResponse(w, toolName, allowedToolsets, logger)

	// Check response
	assert.Equal(t, http.StatusForbidden, w.Code)
	assert.Equal(t, "application/json", w.Header().Get("Content-Type"))

	// Parse response body
	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	assert.Equal(t, "2.0", response["jsonrpc"])
	assert.Nil(t, response["id"])
	
	errorObj, ok := response["error"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, float64(-32601), errorObj["code"])
	assert.Contains(t, errorObj["message"], toolName)
	assert.Contains(t, errorObj["message"], "pipelines")
	assert.Contains(t, errorObj["message"], "ci")
}

func TestHTTPToolFilteringMiddleware_PassThrough(t *testing.T) {
	middleware := NewHTTPToolFilteringMiddleware(createTestLogger(), createTestConfig())

	// Mock handler
	mockHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("pass through"))
	})

	// Non-tools request
	req := httptest.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()

	// Wrap handler with middleware
	wrappedHandler := middleware.Wrap(mockHandler)
	wrappedHandler.ServeHTTP(w, req)

	// Should pass through unchanged
	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "pass through", w.Body.String())
}
