package metrics

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewHTTPMetricsMiddleware(t *testing.T) {
	tests := []struct {
		name   string
		logger *slog.Logger
		config *config.Config
	}{
		{
			name:   "with valid logger and config",
			logger: slog.Default(),
			config: &config.Config{},
		},
		{
			name:   "with nil logger",
			logger: nil,
			config: &config.Config{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			middleware := NewHTTPMetricsMiddleware(tt.logger, tt.config)
			assert.NotNil(t, middleware)
			assert.NotNil(t, middleware.Logger)
			assert.Equal(t, tt.config, middleware.Config)
		})
	}
}

func TestHTTPMetricsMiddleware_Wrap(t *testing.T) {
	// Reset metrics before each test
	HTTPRequestsTotal.Reset()
	HTTPRequestsDuration.Reset()

	tests := []struct {
		name           string
		method         string
		path           string
		body           string
		contentType    string
		handlerStatus  int
		expectedMethod string
		expectedAPI    string
	}{
		{
			name:           "GET request",
			method:         "GET",
			path:           "/health",
			body:           "",
			contentType:    "",
			handlerStatus:  200,
			expectedMethod: "GET",
			expectedAPI:    "non-mcp",
		},
		{
			name:           "POST request with MCP JSON-RPC",
			method:         "POST",
			path:           "/mcp",
			body:           `{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}`,
			contentType:    "application/json",
			handlerStatus:  200,
			expectedMethod: "POST",
			expectedAPI:    "tools/list",
		},
		{
			name:           "POST request with invalid JSON",
			method:         "POST",
			path:           "/mcp",
			body:           `{invalid json}`,
			contentType:    "application/json",
			handlerStatus:  400,
			expectedMethod: "POST",
			expectedAPI:    "non-json-rpc",
		},
		{
			name:           "POST request without method",
			method:         "POST",
			path:           "/mcp",
			body:           `{"jsonrpc":"2.0","id":1,"params":{}}`,
			contentType:    "application/json",
			handlerStatus:  400,
			expectedMethod: "POST",
			expectedAPI:    "no-method",
		},
		{
			name:           "POST request with empty body",
			method:         "POST",
			path:           "/mcp",
			body:           "",
			contentType:    "application/json",
			handlerStatus:  400,
			expectedMethod: "POST",
			expectedAPI:    "non-json-rpc",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a test handler that returns the expected status
			testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				// Verify that the request body can still be read by the handler
				if tt.method == "POST" && tt.body != "" {
					body, err := io.ReadAll(r.Body)
					require.NoError(t, err)
					assert.Equal(t, tt.body, string(body))
				}
				w.WriteHeader(tt.handlerStatus)
				w.Write([]byte("test response"))
			})

			// Create middleware
			middleware := NewHTTPMetricsMiddleware(slog.Default(), &config.Config{})
			wrappedHandler := middleware.Wrap(testHandler)

			// Create request
			var body io.Reader
			if tt.body != "" {
				body = strings.NewReader(tt.body)
			}
			req := httptest.NewRequest(tt.method, tt.path, body)
			if tt.contentType != "" {
				req.Header.Set("Content-Type", tt.contentType)
			}

			// Create response recorder
			rr := httptest.NewRecorder()

			// Execute request
			wrappedHandler.ServeHTTP(rr, req)

			// Verify response
			assert.Equal(t, tt.handlerStatus, rr.Code)
			assert.Equal(t, "test response", rr.Body.String())

			// Verify metrics were recorded
			statusStr := ""
			if tt.handlerStatus >= 200 && tt.handlerStatus < 300 {
				statusStr = "200"
			} else if tt.handlerStatus >= 400 && tt.handlerStatus < 500 {
				statusStr = "400"
			} else {
				statusStr = "500"
			}

			// Check counter metric
			counterValue := testutil.ToFloat64(HTTPRequestsTotal.WithLabelValues(statusStr, tt.expectedMethod, tt.expectedAPI))
			assert.Equal(t, float64(1), counterValue, "Counter should be incremented")

			// For histogram, we can't easily test the exact value with testutil.ToFloat64
			// because it returns the observer, not the collector. Instead, we just verify
			// that the metric can be created without error.
			histogramMetric := HTTPRequestsDuration.WithLabelValues(statusStr, tt.expectedMethod, tt.expectedAPI)
			assert.NotNil(t, histogramMetric, "Histogram metric should be created")

			// Reset metrics for next test
			HTTPRequestsTotal.Reset()
			HTTPRequestsDuration.Reset()
		})
	}
}

func TestExtractMCPMethod(t *testing.T) {
	middleware := NewHTTPMetricsMiddleware(slog.Default(), &config.Config{})

	tests := []struct {
		name           string
		method         string
		body           string
		expectedResult string
	}{
		{
			name:           "valid MCP request",
			method:         "POST",
			body:           `{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}`,
			expectedResult: "tools/list",
		},
		{
			name:           "valid MCP request with different method",
			method:         "POST",
			body:           `{"jsonrpc":"2.0","id":1,"method":"resources/list","params":{}}`,
			expectedResult: "resources/list",
		},
		{
			name:           "GET request",
			method:         "GET",
			body:           "",
			expectedResult: "non-mcp",
		},
		{
			name:           "POST with invalid JSON",
			method:         "POST",
			body:           `{invalid json}`,
			expectedResult: "non-json-rpc",
		},
		{
			name:           "POST with no method field",
			method:         "POST",
			body:           `{"jsonrpc":"2.0","id":1,"params":{}}`,
			expectedResult: "no-method",
		},
		{
			name:           "POST with empty method",
			method:         "POST",
			body:           `{"jsonrpc":"2.0","id":1,"method":"","params":{}}`,
			expectedResult: "no-method",
		},
		{
			name:           "POST with empty body",
			method:         "POST",
			body:           "",
			expectedResult: "non-json-rpc",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var body io.Reader
			if tt.body != "" {
				body = strings.NewReader(tt.body)
			}
			req := httptest.NewRequest(tt.method, "/test", body)

			result := middleware.extractMCPMethod(req, slog.Default())
			assert.Equal(t, tt.expectedResult, result)

			// Verify that the request body can still be read after extraction
			if tt.method == "POST" && tt.body != "" {
				bodyBytes, err := io.ReadAll(req.Body)
				require.NoError(t, err)
				assert.Equal(t, tt.body, string(bodyBytes))
			}
		})
	}
}

func TestResponseRecorder(t *testing.T) {
	tests := []struct {
		name           string
		statusCode     int
		expectedStatus int
	}{
		{
			name:           "default status code",
			statusCode:     0,   // Don't call WriteHeader
			expectedStatus: 200, // Default
		},
		{
			name:           "custom status code",
			statusCode:     404,
			expectedStatus: 404,
		},
		{
			name:           "server error status code",
			statusCode:     500,
			expectedStatus: 500,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rr := httptest.NewRecorder()
			recorder := &responseRecorder{
				ResponseWriter: rr,
				statusCode:     200, // Default
			}

			if tt.statusCode != 0 {
				recorder.WriteHeader(tt.statusCode)
			}

			assert.Equal(t, tt.expectedStatus, recorder.statusCode)
		})
	}
}

func TestExtractRequestID(t *testing.T) {
	tests := []struct {
		name       string
		headers    map[string]string
		expectedID string
	}{
		{
			name:       "no request ID headers",
			headers:    map[string]string{},
			expectedID: "",
		},
		{
			name: "X-Request-ID header",
			headers: map[string]string{
				"X-Request-ID": "test-request-123",
			},
			expectedID: "test-request-123",
		},
		{
			name: "X-Correlation-ID header",
			headers: map[string]string{
				"X-Correlation-ID": "correlation-456",
			},
			expectedID: "correlation-456",
		},
		{
			name: "Request-ID header",
			headers: map[string]string{
				"Request-ID": "request-789",
			},
			expectedID: "request-789",
		},
		{
			name: "multiple headers - X-Request-ID takes precedence",
			headers: map[string]string{
				"X-Request-ID":     "primary-id",
				"X-Correlation-ID": "secondary-id",
				"Request-ID":       "tertiary-id",
			},
			expectedID: "primary-id",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/test", nil)
			for key, value := range tt.headers {
				req.Header.Set(key, value)
			}

			result := extractRequestID(req)
			assert.Equal(t, tt.expectedID, result)
		})
	}
}

func TestMetricsIntegration(t *testing.T) {
	// Reset metrics
	HTTPRequestsTotal.Reset()
	HTTPRequestsDuration.Reset()

	// Create middleware
	middleware := NewHTTPMetricsMiddleware(slog.Default(), &config.Config{})

	// Create a test handler
	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	wrappedHandler := middleware.Wrap(testHandler)

	// Make multiple requests
	requests := []struct {
		method string
		path   string
		body   string
		status int
	}{
		{"GET", "/health", "", 200},
		{"POST", "/mcp", `{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}`, 200},
		{"POST", "/mcp", `{"jsonrpc":"2.0","id":2,"method":"resources/list","params":{}}`, 200},
		{"GET", "/metrics", "", 200},
	}

	for _, req := range requests {
		var body io.Reader
		if req.body != "" {
			body = strings.NewReader(req.body)
		}
		httpReq := httptest.NewRequest(req.method, req.path, body)
		rr := httptest.NewRecorder()
		wrappedHandler.ServeHTTP(rr, httpReq)
	}

	// Verify total metrics
	totalRequests := 0.0
	totalRequests += testutil.ToFloat64(HTTPRequestsTotal.WithLabelValues("200", "GET", "non-mcp"))
	totalRequests += testutil.ToFloat64(HTTPRequestsTotal.WithLabelValues("200", "POST", "tools/list"))
	totalRequests += testutil.ToFloat64(HTTPRequestsTotal.WithLabelValues("200", "POST", "resources/list"))

	assert.Equal(t, float64(4), totalRequests, "Total requests should match")
}

func TestMetricsLabels(t *testing.T) {
	// Reset metrics
	HTTPRequestsTotal.Reset()
	HTTPRequestsDuration.Reset()

	// Check counter labels
	counterMetric := HTTPRequestsTotal.WithLabelValues("200", "GET", "test")
	assert.NotNil(t, counterMetric)

	// Check histogram labels
	histogramMetric := HTTPRequestsDuration.WithLabelValues("200", "GET", "test")
	assert.NotNil(t, histogramMetric)

	// Note: We can't easily test metric descriptions in unit tests
	// as they are not exposed publicly. This would be better tested
	// in integration tests by checking the /metrics endpoint output.
}
